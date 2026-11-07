"""Backups (spec 16): one .zip per backup, in <data folder>/backups.

Each zip holds:
  pharmagraph.db   a consistent copy of the database (SQLite's backup API, safe while the app runs)
  manifest.json    when, why, schema version, database id, row counts per table, SHA-256 checksums

Validation re-opens the copy and checks it (integrity, foreign keys, counts, checksums).
Restore always validates first and backs up the current state first, so it can be undone.
"""
import hashlib
import json
import re
import sqlite3
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from .. import config
from ..db.connection import connect
from ..db.migrate import has_pending, latest_version, migrate, schema_version
from ..util import now
from .errors import Invalid, NotFound

FORMAT_VERSION = 1
REMINDER_DAYS = 30
KINDS = ("manual", "pre-migration", "pre-restore")
NAME_PATTERN = re.compile(r"pharmagraph-[0-9A-Z_-]+-(manual|pre-migration|pre-restore)\.zip")


# ---------- small helpers ----------

def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def _copy_database(source: Path, target: Path, scratch: bool = False) -> None:
    """Copy a whole database with SQLite's backup API (consistent even while the app is writing).

    scratch=True: the target is a temporary file that is checked afterwards, so SQLite's crash protection
    on it is switched off (about 5x faster). Never use it for the live database.
    """
    src, dst = connect(source), sqlite3.connect(target)
    try:
        if scratch:
            dst.execute("PRAGMA journal_mode = OFF")
            dst.execute("PRAGMA synchronous = OFF")
        src.backup(dst)
    finally:
        src.close()
        dst.close()


def _table_counts(conn) -> dict[str, int]:
    names = [r[0] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
    return {n: conn.execute(f'SELECT COUNT(*) FROM "{n}"').fetchone()[0] for n in names}


def _database_id(conn) -> str | None:
    try:
        row = conn.execute("SELECT value FROM app_meta WHERE key = 'database_id'").fetchone()
        return row[0] if row else None
    except sqlite3.OperationalError:  # a database from before app_meta existed
        return None


def backup_path(name: str) -> Path:
    """The backup file for a name, refusing anything that is not a plain backup file name."""
    if not NAME_PATTERN.fullmatch(name):
        raise NotFound(f"No backup called {name}")
    path = config.backups_dir() / name
    if not path.is_file():
        raise NotFound(f"No backup called {name}")
    return path


# ---------- create ----------

def create_backup(kind: str = "manual") -> dict:
    if kind not in KINDS:
        raise Invalid(f"Unknown backup kind: {kind}")
    db = config.db_path()
    if not db.exists():
        raise Invalid("There is no database to back up yet.")
    folder = config.backups_dir()
    folder.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%S_%fZ")  # no ':' (not allowed in Windows names)
    name = f"pharmagraph-{stamp}-{kind}.zip"

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        copy = Path(tmp) / "pharmagraph.db"
        _copy_database(db, copy, scratch=True)
        conn = connect(copy)
        try:
            manifest = {
                "format_version": FORMAT_VERSION,
                "kind": kind,
                "created_at": now(),
                "app_version": config.APP_VERSION,
                "schema_version": schema_version(conn),
                "database_id": _database_id(conn),
                "counts": _table_counts(conn),
            }
        finally:
            conn.close()
        manifest["files"] = {"pharmagraph.db": _sha256(copy)}
        # shortcut: documents and images (files/ folder) do not exist until Stage 2; add them here then.
        partial = folder / (name + ".partial")
        with zipfile.ZipFile(partial, "w", zipfile.ZIP_DEFLATED, compresslevel=1) as z:  # fast; size barely differs
            z.write(copy, "pharmagraph.db")
            z.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False))
        partial.replace(folder / name)  # only a completely written zip ever gets its real name

    report = validate_backup(name)
    if not report["ok"]:
        raise Invalid("The new backup failed its own check: " + "; ".join(report["problems"]))
    return _summary(name, manifest)


# ---------- validate ----------

def _check(path: Path, workdir: Path) -> tuple[dict | None, Path | None, list[str]]:
    """Unpack a backup into workdir and check everything. Returns (manifest, database copy, problems)."""
    problems: list[str] = []
    manifest = copy = None
    try:
        with zipfile.ZipFile(path) as z:
            missing = {"manifest.json", "pharmagraph.db"} - set(z.namelist())
            if missing:
                return None, None, [f"Missing from the backup: {', '.join(sorted(missing))}"]
            manifest = json.loads(z.read("manifest.json"))
            z.extract("pharmagraph.db", workdir)
        copy = workdir / "pharmagraph.db"
        if _sha256(copy) != manifest["files"]["pharmagraph.db"]:
            problems.append("The database file does not match its checksum (it was changed or damaged).")
        conn = connect(copy)
        try:
            if conn.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                problems.append("SQLite integrity check failed.")
            if conn.execute("PRAGMA foreign_key_check").fetchall():
                problems.append("Some links point to items that do not exist.")
            if _table_counts(conn) != manifest["counts"]:
                problems.append("Row counts differ from the manifest.")
        finally:
            conn.close()
        if manifest["schema_version"] > latest_version():
            problems.append("This backup was made by a newer version of PharmaGraph. Update the app first.")
    except (zipfile.BadZipFile, json.JSONDecodeError, KeyError, TypeError, sqlite3.DatabaseError, OSError) as e:
        problems.append(f"The backup file cannot be read: {e}")
    return manifest, copy, problems


def validate_backup(name: str) -> dict:
    path = backup_path(name)
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        manifest, _, problems = _check(path, Path(tmp))
    return {"name": name, "ok": not problems, "problems": problems, "manifest": manifest}


# ---------- restore ----------

def restore_backup(name: str) -> dict:
    path = backup_path(name)
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        manifest, copy, problems = _check(path, Path(tmp))
        if problems:
            raise Invalid("This backup failed validation, nothing was changed: " + " ".join(problems))
        safety = create_backup("pre-restore")["name"] if config.db_path().exists() else None
        migrate(copy)  # an older backup is upgraded on the temporary copy, never in the zip itself
        config.data_dir().mkdir(parents=True, exist_ok=True)
        # Copy INTO the live database (instead of replacing the file): works even while it is open,
        # and happens as one step.
        _copy_database(copy, config.db_path())
    conn = connect(config.db_path())
    try:
        healthy = conn.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    finally:
        conn.close()
    if not healthy:
        raise Invalid(f"The restored database failed its check. Your previous state is in {safety}.")
    return {"restored": name, "safety_backup": safety, "manifest": manifest}


# ---------- list, reminder, startup ----------

def _summary(name: str, manifest: dict) -> dict:
    return {"name": name, "kind": manifest.get("kind"), "created_at": manifest.get("created_at"),
            "schema_version": manifest.get("schema_version"), "database_id": manifest.get("database_id"),
            "entities": manifest.get("counts", {}).get("entity"),
            "size_bytes": (config.backups_dir() / name).stat().st_size}


def list_backups() -> list[dict]:
    folder = config.backups_dir()
    if not folder.exists():
        return []
    result = []
    for path in sorted(folder.glob("pharmagraph-*.zip"), reverse=True):
        if not NAME_PATTERN.fullmatch(path.name):
            continue
        try:
            with zipfile.ZipFile(path) as z:
                result.append(_summary(path.name, json.loads(z.read("manifest.json"))))
        except (zipfile.BadZipFile, json.JSONDecodeError, KeyError, OSError):
            result.append({"name": path.name, "error": "unreadable", "size_bytes": path.stat().st_size})
    return sorted(result, key=lambda b: b.get("created_at") or "", reverse=True)


def reminder_due(last_backup_at: str | None, has_data: bool, today: datetime) -> bool:
    """Spec 16: remind monthly. No reminder for an empty knowledge base."""
    if not has_data:
        return False
    if last_backup_at is None:
        return True
    last = datetime.fromisoformat(last_backup_at.replace("Z", "+00:00"))
    return (today - last).days >= REMINDER_DAYS


def status() -> dict:
    backups = [b for b in list_backups() if "error" not in b]
    last = backups[0]["created_at"] if backups else None
    has_data = False
    if config.db_path().exists():
        conn = connect(config.db_path())
        try:
            has_data = conn.execute("SELECT EXISTS (SELECT 1 FROM entity)").fetchone()[0] == 1
        finally:
            conn.close()
    return {"last_backup_at": last, "backups_folder": str(config.backups_dir().resolve()),
            "reminder": reminder_due(last, has_data, datetime.now(timezone.utc))}


def prepare_database() -> list[str]:
    """Run at startup: back up an existing database before upgrading its structure (spec 16)."""
    if has_pending(config.db_path()):
        create_backup("pre-migration")
    return migrate(config.db_path())
