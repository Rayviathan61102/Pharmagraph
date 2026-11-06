"""M2: entities, aliases and revision history."""
import pytest


def make(client, name="Paracetamol", aliases=(), **extra):
    body = {"entity_type_id": "drug", "name": name,
            "aliases": [{"alias": a} for a in aliases], **extra}
    response = client.post("/api/entities", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def revisions(client, entity_id):
    return client.get(f"/api/entities/{entity_id}/revisions").json()


def test_create_entity_with_alias(client):
    e = make(client, aliases=["Acetaminophen"])
    assert e["name"] == "Paracetamol" and e["status_code"] == "proposed" and e["version"] == 1
    assert [a["alias"] for a in e["aliases"]] == ["Acetaminophen"]
    assert [r["change_kind"] for r in revisions(client, e["id"])] == ["create"]


def test_edit_keeps_the_old_text(client):
    e = make(client, description="Old text")
    r = client.patch(f"/api/entities/{e['id']}", json={"description": "New text", "reason": "clarified"})
    assert r.json()["description"] == "New text" and r.json()["version"] == 2
    history = revisions(client, e["id"])
    assert [(h["version"], h["change_kind"]) for h in history] == [(2, "update"), (1, "create")]
    assert history[0]["reason"] == "clarified"
    assert history[1]["snapshot"]["description"] == "Old text"


def test_edit_with_identical_values_makes_no_new_version(client):
    e = make(client, description="Same")
    r = client.patch(f"/api/entities/{e['id']}", json={"description": "Same"})
    assert r.json()["version"] == 1 and len(revisions(client, e["id"])) == 1


def test_archive_hides_but_keeps_everything(client):
    e = make(client)
    client.post(f"/api/entities/{e['id']}/archive", json={"reason": "entered by mistake"})
    assert client.get("/api/entities").json() == []
    archived = client.get("/api/entities", params={"include_archived": True}).json()
    assert [x["name"] for x in archived] == ["Paracetamol"]
    assert client.get(f"/api/entities/{e['id']}").json()["archive_reason"] == "entered by mistake"
    assert client.patch(f"/api/entities/{e['id']}", json={"name": "X"}).status_code == 400  # restore first
    client.post(f"/api/entities/{e['id']}/unarchive", json={})
    assert [h["change_kind"] for h in revisions(client, e["id"])] == ["unarchive", "archive", "create"]
    assert client.get("/api/entities").json()[0]["archived_at"] is None


def test_duplicate_name_or_alias_is_warned(client):
    original = make(client, aliases=["Acetaminophen"])
    r = client.post("/api/entities", json={"entity_type_id": "drug", "name": "acetaminophen"})
    assert r.status_code == 409
    assert [d["id"] for d in r.json()["possible_duplicates"]] == [original["id"]]
    make(client, name="acetaminophen", allow_duplicate=True)  # the user may still insist


def test_list_filters_by_name_or_alias(client):
    make(client, aliases=["APAP"])
    make(client, name="Ibuprofen")
    assert [e["name"] for e in client.get("/api/entities", params={"q": "apap"}).json()] == ["Paracetamol"]
    assert [e["name"] for e in client.get("/api/entities", params={"q": "PROF"}).json()] == ["Ibuprofen"]


def test_alias_add_and_remove_are_revisions(client):
    e = make(client)
    e = client.post(f"/api/entities/{e['id']}/aliases", json={"alias": "APAP"}).json()
    alias_id = e["aliases"][0]["id"]
    assert client.post(f"/api/entities/{e['id']}/aliases", json={"alias": "APAP"}).status_code == 400
    e = client.post(f"/api/entities/{e['id']}/aliases/{alias_id}/archive").json()
    assert e["aliases"] == [] and e["version"] == 3
    reasons = [h["reason"] for h in revisions(client, e["id"])]
    assert reasons == ["Removed alias 'APAP'", "Added alias 'APAP'", None]
    assert revisions(client, e["id"])[1]["snapshot"]["aliases"][0]["alias"] == "APAP"


@pytest.mark.parametrize("change", [
    lambda c, i: c.patch(f"/api/entities/{i}", json={"name": "Renamed"}),
    lambda c, i: c.post(f"/api/entities/{i}/aliases", json={"alias": "New alias"}),
    lambda c, i: c.post(f"/api/entities/{i}/archive", json={}),
])
def test_every_change_writes_exactly_one_revision(client, change):
    e = make(client)
    assert change(client, e["id"]).status_code in (200, 201)
    history = revisions(client, e["id"])
    assert len(history) == 2
    assert history[0]["version"] == client.get(f"/api/entities/{e['id']}").json()["version"] == 2


def test_unknown_type_is_rejected(client):
    r = client.post("/api/entities", json={"entity_type_id": "nonsense", "name": "X"})
    assert r.status_code == 400


def test_failed_create_saves_nothing(client):
    # The second alias has an invalid kind, so the whole create must be undone, entity included.
    r = client.post("/api/entities", json={"entity_type_id": "drug", "name": "Paracetamol",
                                           "aliases": [{"alias": "APAP"}, {"alias": "X", "alias_kind": "bad"}]})
    assert r.status_code == 400
    assert client.get("/api/entities", params={"include_archived": True}).json() == []


def test_lookups_for_menus(client):
    data = client.get("/api/lookups").json()
    assert {"statuses", "entity_types", "relationship_types", "sections", "context_kinds"} <= data.keys()
    assert any(t["id"] == "drug" for t in data["entity_types"])
