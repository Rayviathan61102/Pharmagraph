"""Bring any PharmaGraph database up to the newest structure.

Migrations are numbered SQL files in db/migrations (001_initial.sql, 002_....sql).
Each file is applied exactly once, in order, inside a transaction: if it fails, nothing changes.
Rule: never edit a migration that has been applied. Add a new numbered file instead.
"""
import hashlib
import re
from pathlib import Path

from ..util import new_id, now
from .connection import connect, transaction

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


class MigrationError(Exception):
    pass


def migration_files(folder: Path = MIGRATIONS_DIR) -> list[tuple[int, Path]]:
    files = []
    for path in sorted(folder.glob("*.sql")):
        match = re.fullmatch(r"(\d{3})_[a-z0-9_]+\.sql", path.name)
        if not match:
            raise MigrationError(f"Badly named migration file: {path.name} (expected e.g. 003_add_layers.sql)")
        files.append((int(match.group(1)), path))
    return files


def schema_version(conn) -> int:
    """The highest migration number applied to this database (0 for an empty file)."""
    if not conn.execute("SELECT 1 FROM sqlite_master WHERE name = 'schema_migration'").fetchone():
        return 0
    return conn.execute("SELECT coalesce(max(version), 0) FROM schema_migration").fetchone()[0]


def latest_version(folder: Path = MIGRATIONS_DIR) -> int:
    return max((v for v, _ in migration_files(folder)), default=0)


def has_pending(db_path: Path, folder: Path = MIGRATIONS_DIR) -> bool:
    """True when an existing database is older than this version of the app."""
    if not db_path.exists():
        return False
    conn = connect(db_path)
    try:
        return schema_version(conn) < latest_version(folder)
    finally:
        conn.close()


def migrate(db_path: Path, folder: Path = MIGRATIONS_DIR) -> list[str]:
    """Apply pending migrations. Returns the names of the files applied (empty when already up to date)."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = connect(db_path)
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS schema_migration (
              version     INTEGER PRIMARY KEY,
              filename    TEXT NOT NULL,
              checksum    TEXT NOT NULL,
              applied_at  TEXT NOT NULL
            ) STRICT""")
        applied = {row["version"]: row for row in conn.execute("SELECT * FROM schema_migration")}
        done = []
        for version, path in migration_files(folder):
            sql = path.read_text(encoding="utf-8")
            checksum = hashlib.sha256(sql.encode("utf-8")).hexdigest()
            if version in applied:
                if applied[version]["checksum"] != checksum:
                    raise MigrationError(
                        f"{path.name} was changed after it was applied. "
                        "Restore the original file and add a new migration instead.")
                continue
            with transaction(conn):
                conn.executescript(sql)
                conn.execute("INSERT INTO schema_migration VALUES (?, ?, ?, ?)",
                             (version, path.name, checksum, now()))
            done.append(path.name)

        # A permanent ID for this knowledge base, so a backup can be recognised on any computer.
        with transaction(conn):
            conn.execute("INSERT OR IGNORE INTO app_meta VALUES ('database_id', ?)", (new_id(),))
            conn.execute("INSERT OR IGNORE INTO app_meta VALUES ('created_at', ?)", (now(),))
        return done
    finally:
        conn.close()
