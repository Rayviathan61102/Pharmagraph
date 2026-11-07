"""M9: backup, validation and restore."""
import json
import shutil
import zipfile
from datetime import datetime, timedelta, timezone

import pytest

from server import config
from server.db.connection import connect
from server.db.migrate import MIGRATIONS_DIR, migrate
from server.services import backup


def dump() -> list[str]:
    """The whole database as SQL text, for comparing two states exactly."""
    conn = connect(config.db_path())
    try:
        return list(conn.iterdump())
    finally:
        conn.close()


@pytest.fixture
def knowledge(client):
    para = client.post("/api/entities", json={"entity_type_id": "drug", "name": "Paracetamol",
                                               "aliases": [{"alias": "พาราเซตามอล"}]}).json()
    cox = client.post("/api/entities", json={"entity_type_id": "enzyme", "name": "COX"}).json()
    rel = client.post("/api/relationships", json={"source_entity_id": para["id"], "target_entity_id": cox["id"],
                                                  "relationship_type_id": "INHIBITS"}).json()
    book = client.post("/api/sources", json={"source_type": "textbook", "title": "G&G"}).json()
    client.post("/api/evidence", json={"source_id": book["id"], "relationship_id": rel["id"], "locator": "p. 601"})
    return {"para": para, "cox": cox, "rel": rel}


def test_round_trip_restores_exactly(client, knowledge):
    made = client.post("/api/backups").json()
    before = dump()
    # change things: edit, archive, add
    client.patch(f"/api/entities/{knowledge['para']['id']}", json={"description": "changed"})
    client.post(f"/api/relationships/{knowledge['rel']['id']}/archive", json={})
    client.post("/api/entities", json={"entity_type_id": "drug", "name": "Ibuprofen"})
    assert dump() != before

    result = client.post(f"/api/backups/{made['name']}/restore").json()
    assert dump() == before  # every table, row and relationship is back exactly
    assert result["safety_backup"].endswith("-pre-restore.zip")
    # the state just before the restore was kept, so the restore itself can be undone
    client.post(f"/api/backups/{result['safety_backup']}/restore")
    assert any(e["name"] == "Ibuprofen" for e in client.get("/api/entities").json())


def test_search_works_after_restore(client, knowledge):
    made = client.post("/api/backups").json()
    client.post(f"/api/backups/{made['name']}/restore")
    assert [h["name"] for h in client.get("/api/search", params={"q": "ราเซต"}).json()] == ["Paracetamol"]


def test_backup_validates_and_lists(client, knowledge):
    made = client.post("/api/backups").json()
    report = client.post(f"/api/backups/{made['name']}/validate").json()
    assert report["ok"] and report["problems"] == []
    assert report["manifest"]["counts"]["entity"] == 2
    [listed] = client.get("/api/backups").json()
    assert (listed["name"], listed["kind"], listed["entities"]) == (made["name"], "manual", 2)


def test_damaged_backup_is_refused_and_nothing_changes(client, knowledge):
    made = client.post("/api/backups").json()
    path = config.backups_dir() / made["name"]
    path.write_bytes(path.read_bytes()[:500])  # cut the file short
    before = dump()
    assert client.post(f"/api/backups/{made['name']}/validate").json()["ok"] is False
    assert client.post(f"/api/backups/{made['name']}/restore").status_code == 400
    assert dump() == before


def _rewrite(path, db_bytes=None, manifest_change=None):
    """Rebuild a backup zip with a modified database or manifest (to simulate tampering)."""
    with zipfile.ZipFile(path) as z:
        db, manifest = z.read("pharmagraph.db"), json.loads(z.read("manifest.json"))
    if manifest_change:
        manifest.update(manifest_change)
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("pharmagraph.db", db_bytes if db_bytes is not None else db)
        z.writestr("manifest.json", json.dumps(manifest))


def test_changed_database_inside_backup_is_detected(client, knowledge):
    made = client.post("/api/backups").json()
    path = config.backups_dir() / made["name"]
    with zipfile.ZipFile(path) as z:
        db = bytearray(z.read("pharmagraph.db"))
    db[-100] ^= 0xFF  # flip one byte
    _rewrite(path, db_bytes=bytes(db))
    report = client.post(f"/api/backups/{made['name']}/validate").json()
    assert not report["ok"] and "checksum" in " ".join(report["problems"])


def test_backup_from_newer_app_is_refused(client, knowledge):
    made = client.post("/api/backups").json()
    _rewrite(config.backups_dir() / made["name"], manifest_change={"schema_version": 999})
    r = client.post(f"/api/backups/{made['name']}/restore")
    assert r.status_code == 400 and "newer version" in r.json()["detail"]


def test_backup_names_cannot_escape_the_backup_folder(client):
    assert client.post("/api/backups/..%2F..%2Fpharmagraph.db/restore").status_code in (404, 405)
    assert client.post("/api/backups/pharmagraph-x-manual.zip/validate").status_code == 404
    from server.services.errors import NotFound
    for bad in ("../pharmagraph.db", "..\\pharmagraph-1-manual.zip", "pharmagraph.db", "C:/x.zip"):
        with pytest.raises(NotFound):
            backup.backup_path(bad)


def test_restore_on_another_computer(client, knowledge, tmp_path, monkeypatch):
    made = client.post("/api/backups").json()
    zip_path = config.backups_dir() / made["name"]
    # a brand-new data folder, as on a new PC: put the zip in its backups folder and restore
    new_home = tmp_path / "new-pc"
    (new_home / "backups").mkdir(parents=True)
    shutil.copy(zip_path, new_home / "backups" / made["name"])
    monkeypatch.setenv("PHARMAGRAPH_DATA", str(new_home))
    backup.restore_backup(made["name"])
    rels = client.get(f"/api/entities/{knowledge['para']['id']}/relationships").json()
    assert rels[0]["other_name"] == "COX" and rels[0]["evidence"][0]["locator"] == "p. 601"


def test_old_backup_is_upgraded_when_restored(data_dir):
    """A backup made before migration 003 restores into the current structure."""
    old = data_dir / "old"
    old.mkdir()
    for name in ("001_initial.sql", "002_default_data.sql"):
        shutil.copy(MIGRATIONS_DIR / name, old / name)
    migrate(config.db_path(), old)
    conn = connect(config.db_path())
    conn.execute("INSERT INTO entity (id, entity_type_id, name, status_code, created_at, updated_at) "
                 "VALUES ('E1', 'drug', 'Ibuprofen', 'proposed', 't', 't')")
    conn.close()
    made = backup.create_backup()
    backup.restore_backup(made["name"])
    conn = connect(config.db_path())
    try:
        assert conn.execute("SELECT max(version) FROM schema_migration").fetchone()[0] >= 3
        assert conn.execute("SELECT entity_id FROM search_index WHERE search_index MATCH '\"ibupro\"'").fetchone()
    finally:
        conn.close()


def test_backup_is_made_before_upgrading_the_database(data_dir):
    old = data_dir / "old"
    old.mkdir()
    shutil.copy(MIGRATIONS_DIR / "001_initial.sql", old / "001_initial.sql")
    migrate(config.db_path(), old)
    assert backup.prepare_database()  # applies the newer migrations ...
    assert [b["kind"] for b in backup.list_backups()] == ["pre-migration"]  # ... after backing up
    assert backup.prepare_database() == [] and len(backup.list_backups()) == 1  # nothing pending: no backup


def test_monthly_reminder():
    today = datetime(2026, 11, 7, tzinfo=timezone.utc)
    recent = (today - timedelta(days=5)).isoformat()
    old = (today - timedelta(days=31)).isoformat()
    assert backup.reminder_due(None, has_data=True, today=today)
    assert not backup.reminder_due(None, has_data=False, today=today)
    assert not backup.reminder_due(recent, has_data=True, today=today)
    assert backup.reminder_due(old, has_data=True, today=today)


def test_status_reports_reminder(client, knowledge):
    assert client.get("/api/backups/status").json()["reminder"] is True
    client.post("/api/backups")
    status = client.get("/api/backups/status").json()
    assert status["reminder"] is False and status["last_backup_at"]
