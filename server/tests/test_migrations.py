"""M1: the database foundation."""
import shutil
import sqlite3

import pytest

from server import config
from server.db.migrate import MIGRATIONS_DIR, MigrationError, migrate
from server.util import now


def test_new_data_folder_gets_a_database(data_dir):
    applied = migrate(config.db_path())
    assert applied[:2] == ["001_initial.sql", "002_default_data.sql"]
    assert applied == sorted(applied)
    assert config.db_path().exists()


def test_running_again_changes_nothing(data_dir):
    migrate(config.db_path())
    assert migrate(config.db_path()) == []


def test_database_id_is_created_once_and_kept(conn):
    first = conn.execute("SELECT value FROM app_meta WHERE key = 'database_id'").fetchone()[0]
    migrate(config.db_path())
    assert conn.execute("SELECT value FROM app_meta WHERE key = 'database_id'").fetchone()[0] == first


def test_foreign_keys_are_on_and_clean(conn):
    assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1
    assert conn.execute("PRAGMA foreign_key_check").fetchall() == []


def test_default_reference_data_is_present(conn):
    count = lambda table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    assert count("verification_status") == 6
    assert count("relationship_type") >= 16  # later migrations may add more
    assert conn.execute("SELECT inverse_label FROM relationship_type WHERE id = 'TREATS'").fetchone()[0] == "treated by"


def _add_entity(conn, entity_id="E1"):
    t = now()
    conn.execute("INSERT INTO entity (id, entity_type_id, name, status_code, created_at, updated_at) "
                 "VALUES (?, 'drug', 'Paracetamol', 'proposed', ?, ?)", (entity_id, t, t))


def test_deleting_an_entity_is_refused(conn):
    _add_entity(conn)
    with pytest.raises(sqlite3.IntegrityError, match="archived, never deleted"):
        conn.execute("DELETE FROM entity WHERE id = 'E1'")


def test_revisions_cannot_be_changed(conn):
    _add_entity(conn)
    conn.execute("INSERT INTO revision (id, entity_id, version, change_kind, snapshot_json, changed_by, created_at) "
                 "VALUES ('V1', 'E1', 1, 'create', '{}', 'user', ?)", (now(),))
    with pytest.raises(sqlite3.IntegrityError, match="permanent"):
        conn.execute("UPDATE revision SET reason = 'sneaky edit'")
    with pytest.raises(sqlite3.IntegrityError, match="permanent"):
        conn.execute("DELETE FROM revision")


def test_unknown_entity_type_is_refused(conn):
    t = now()
    with pytest.raises(sqlite3.IntegrityError, match="FOREIGN KEY"):
        conn.execute("INSERT INTO entity (id, entity_type_id, name, status_code, created_at, updated_at) "
                     "VALUES ('E2', 'not_a_type', 'X', 'proposed', ?, ?)", (t, t))


def test_editing_an_applied_migration_is_detected(data_dir, tmp_path):
    folder = tmp_path / "migrations"
    shutil.copytree(MIGRATIONS_DIR, folder)
    migrate(config.db_path(), folder)
    (folder / "002_default_data.sql").write_text("-- changed", encoding="utf-8")
    with pytest.raises(MigrationError, match="changed after it was applied"):
        migrate(config.db_path(), folder)


def test_failing_migration_changes_nothing(data_dir, tmp_path):
    folder = tmp_path / "migrations"
    shutil.copytree(MIGRATIONS_DIR, folder)
    migrate(config.db_path(), folder)
    applied_before = len(list(folder.glob("*.sql")))
    (folder / "999_broken.sql").write_text(
        "CREATE TABLE half_done (id TEXT);\nTHIS IS NOT SQL;", encoding="utf-8")
    with pytest.raises(sqlite3.OperationalError):
        migrate(config.db_path(), folder)
    check = sqlite3.connect(config.db_path())
    tables = [r[0] for r in check.execute("SELECT name FROM sqlite_master WHERE type = 'table'")]
    versions = [r[0] for r in check.execute("SELECT version FROM schema_migration")]
    check.close()
    assert "half_done" not in tables
    assert len(versions) == applied_before and 999 not in versions
