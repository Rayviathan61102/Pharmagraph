"""M6: search by name, other names, Thai text and knowledge entries."""
import time

import pytest

from server import config
from server.db.connection import connect
from server.db.migrate import migrate


@pytest.fixture
def para(client):
    e = client.post("/api/entities", json={
        "entity_type_id": "drug", "name": "Paracetamol", "description": "Analgesic and antipyretic",
        "aliases": [{"alias": "Acetaminophen"}, {"alias": "APAP"}, {"alias": "พาราเซตามอล"}]}).json()
    client.post(f"/api/entities/{e['id']}/entries", json={
        "scope": "general", "section_id": "toxicity", "body": "Overdose depletes glutathione; NAPQI accumulates."})
    return e


def names(client, q, **params):
    return [r["name"] for r in client.get("/api/search", params={"q": q, **params}).json()]


def test_find_by_part_of_an_alias(client, para):
    assert names(client, "acetamino") == ["Paracetamol"]
    assert names(client, "APAP") == ["Paracetamol"]


def test_find_by_thai_substring(client, para):
    assert names(client, "ราเซต") == ["Paracetamol"]


def test_short_query_falls_back_to_scan(client, para):
    assert names(client, "AP") == ["Paracetamol"]
    [hit] = client.get("/api/search", params={"q": "qi"}).json()  # only in "NAPQI", inside the entry
    assert "NAP\u0002QI\u0003 accumulates" in hit["snippet"] and len(hit["snippet"]) < 100


def test_find_by_words_in_knowledge_entries_with_snippet(client, para):
    [hit] = client.get("/api/search", params={"q": "glutathione"}).json()
    assert hit["matched"] == ["entry"] and "\u0002glutathione\u0003" in hit["snippet"]


def test_several_words_must_all_match(client, para):
    assert names(client, "glutathione napqi") == ["Paracetamol"]
    assert names(client, "glutathione aspirin") == []


def test_archived_entities_are_excluded_by_default(client, para):
    client.post(f"/api/entities/{para['id']}/archive", json={})
    assert names(client, "paracetamol") == []
    assert names(client, "paracetamol", include_archived=True) == ["Paracetamol"]


def test_index_follows_changes(client, para):
    apap = next(a for a in para["aliases"] if a["alias"] == "APAP")
    client.post(f"/api/entities/{para['id']}/aliases/{apap['id']}/archive")
    assert names(client, "APAP") == []
    client.patch(f"/api/entities/{para['id']}", json={"name": "Paracetamol (acetaminophen)"})
    assert names(client, "paracetamol (") == ["Paracetamol (acetaminophen)"]


def test_exact_name_comes_first(client, para):
    client.post("/api/entities", json={"entity_type_id": "drug", "name": "Paracetamol overdose antidote"})
    assert names(client, "paracetamol") == ["Paracetamol", "Paracetamol overdose antidote"]


def test_quotes_in_query_are_harmless(client, para):
    assert client.get("/api/search", params={"q": 'para"cet OR *'}).status_code == 200


def test_migration_indexes_data_created_before_search(data_dir):
    """A database from before M6 (only migrations 001-002) gets indexed by migration 003."""
    import shutil
    from server.db.migrate import MIGRATIONS_DIR
    old = data_dir / "old_migrations"
    old.mkdir()
    for name in ("001_initial.sql", "002_default_data.sql"):
        shutil.copy(MIGRATIONS_DIR / name, old / name)
    migrate(config.db_path(), old)
    conn = connect(config.db_path())
    conn.execute("INSERT INTO entity (id, entity_type_id, name, status_code, created_at, updated_at) "
                 "VALUES ('E1', 'drug', 'Ibuprofen', 'proposed', 't', 't')")
    migrate(config.db_path())  # now applies 003
    assert conn.execute("SELECT entity_id FROM search_index WHERE search_index MATCH '\"ibuprof\"'").fetchall()[0][0] == "E1"
    conn.close()


def test_search_is_fast_enough(client, para):
    for i in range(300):
        client.post("/api/entities", json={"entity_type_id": "drug", "name": f"Test compound {i}",
                                           "description": "filler text for timing"})
    start = time.perf_counter()
    client.get("/api/search", params={"q": "compound 12"})
    assert time.perf_counter() - start < 0.3
