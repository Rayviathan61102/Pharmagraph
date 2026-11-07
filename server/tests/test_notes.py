"""M12: personal notes."""
import pytest


@pytest.fixture
def para(client):
    e = client.post("/api/entities", json={"entity_type_id": "drug", "name": "Paracetamol"}).json()
    [entry] = client.post(f"/api/entities/{e['id']}/entries",
                          json={"scope": "general", "section_id": "mechanism", "body": "Central COX inhibition"}).json()
    return {"entity": e["id"], "entry": entry["id"]}


def note(client, **body):
    r = client.post("/api/notes", json={"body": "Look up why NAPQI depletes glutathione", **body})
    assert r.status_code == 201, r.text
    return r.json()


def test_unattached_note_goes_to_the_inbox(client):
    n = note(client)
    assert n["stage"] == "inbox"
    assert [x["id"] for x in client.get("/api/notes", params={"inbox": True}).json()] == [n["id"]]
    assert client.get("/api/notes/inbox-count").json() == {"count": 1}


def test_note_on_an_entry_never_changes_the_entry(client, para):
    before = client.get(f"/api/entries/{para['entry']}").json()
    revisions_before = client.get(f"/api/entries/{para['entry']}/revisions").json()
    n = note(client, knowledge_entry_id=para["entry"], body="Mnemonic: Central = Cerebral")
    client.patch(f"/api/notes/{n['id']}", json={"body": "Edited note"})
    after = client.get(f"/api/entries/{para['entry']}").json()
    assert (after["body"], after["version"], after["updated_at"]) == (before["body"], before["version"], before["updated_at"])
    assert client.get(f"/api/entries/{para['entry']}/revisions").json() == revisions_before
    # it is listed with the entity it belongs to, labelled with the section
    [listed] = client.get("/api/notes", params={"entity_id": para["entity"]}).json()
    assert (listed["body"], listed["section_label"], listed["about_entity_name"]) == ("Edited note", "Mechanism of action", "Paracetamol")


def test_attaching_from_the_inbox(client, para):
    n = note(client)
    moved = client.patch(f"/api/notes/{n['id']}", json={"entity_id": para["entity"], "stage": "connected"}).json()
    assert moved["entity_id"] == para["entity"] and moved["stage"] == "connected"
    assert client.get("/api/notes", params={"inbox": True}).json() == []
    detached = client.patch(f"/api/notes/{n['id']}", json={"entity_id": None}).json()
    assert detached["entity_id"] is None


def test_one_attachment_at_most(client, para):
    r = client.post("/api/notes", json={"body": "x", "entity_id": para["entity"], "knowledge_entry_id": para["entry"]})
    assert r.status_code == 400
    assert client.post("/api/notes", json={"body": "x", "entity_id": "no-such-entity"}).status_code == 404


def test_archive_hides_note(client):
    n = note(client)
    client.post(f"/api/notes/{n['id']}/archive")
    assert client.get("/api/notes").json() == []
    assert len(client.get("/api/notes", params={"include_archived": True}).json()) == 1
    assert client.patch(f"/api/notes/{n['id']}", json={"body": "y"}).status_code == 400
