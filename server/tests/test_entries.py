"""M3: knowledge entries, lectures, and General / Lecture / Personal / Both."""
import pytest

from server.services import entries
from server.services.errors import Invalid


@pytest.fixture
def entity_id(client):
    return client.post("/api/entities", json={"entity_type_id": "drug", "name": "Paracetamol"}).json()["id"]


@pytest.fixture
def lecture_id(client):
    professor = client.post("/api/professors", json={"name": "Dr. A"}).json()
    return client.post("/api/lectures", json={"title": "Analgesics", "course_code": "PHA301",
                                              "professor_id": professor["id"]}).json()["id"]


def add(client, entity_id, **body):
    body = {"section_id": "mechanism", **body}
    response = client.post(f"/api/entities/{entity_id}/entries", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_general_and_lecture_entries_stay_separate(client, entity_id, lecture_id):
    [general] = add(client, entity_id, scope="general", body="Weak COX inhibitor, mainly central.")
    [lecture] = add(client, entity_id, scope="lecture", body="Dr. A: acts centrally.", lecture_id=lecture_id)
    assert lecture["lecture_title"] == "Analgesics" and lecture["professor_name"] == "Dr. A"

    client.patch(f"/api/entries/{general['id']}", json={"body": "Updated general text", "reason": "new source"})
    unchanged = client.get(f"/api/entries/{lecture['id']}").json()
    assert unchanged["body"] == "Dr. A: acts centrally." and unchanged["version"] == 1
    assert [e["scope"] for e in client.get(f"/api/entities/{entity_id}/entries").json()] == ["general", "lecture"]


def test_both_creates_two_linked_entries(client, entity_id, lecture_id):
    general, lecture = add(client, entity_id, scope="both", body="Inhibits COX in the CNS.",
                           lecture_id=lecture_id, lecture_body="Slide 12: central COX inhibition.")
    assert (general["scope"], lecture["scope"]) == ("general", "lecture")
    assert general["counterpart_entry_id"] == lecture["id"] and lecture["counterpart_entry_id"] == general["id"]
    assert lecture["body"] == "Slide 12: central COX inhibition." and lecture["lecture_id"] == lecture_id

    client.patch(f"/api/entries/{lecture['id']}", json={"body": "Changed lecture wording"})
    assert client.get(f"/api/entries/{general['id']}").json()["body"] == "Inhibits COX in the CNS."
    # each half has its own history
    assert len(client.get(f"/api/entries/{lecture['id']}/revisions").json()) == 2
    assert len(client.get(f"/api/entries/{general['id']}/revisions").json()) == 1


def test_both_without_separate_lecture_text_copies_the_body(client, entity_id):
    general, lecture = add(client, entity_id, scope="both", body="Same text")
    assert general["body"] == lecture["body"] == "Same text"


def test_personal_entry(client, entity_id):
    [note] = add(client, entity_id, scope="personal", section_id="mnemonic", body="PARA = Pain And Raised temp")
    assert note["scope"] == "personal" and note["section_label"] == "Mnemonics"


def test_lecture_link_only_for_lecture_entries(client, entity_id, lecture_id):
    r = client.post(f"/api/entities/{entity_id}/entries",
                    json={"scope": "general", "section_id": "mechanism", "body": "x", "lecture_id": lecture_id})
    assert r.status_code == 400


def test_scope_cannot_be_changed_later(client, entity_id):
    [general] = add(client, entity_id, scope="general", body="x")
    # 'scope' is not an editable field, so it is ignored by the request model and nothing changes
    client.patch(f"/api/entries/{general['id']}", json={"scope": "personal"})
    assert client.get(f"/api/entries/{general['id']}").json()["scope"] == "general"


def test_entries_cannot_be_added_to_archived_entity(client, entity_id):
    client.post(f"/api/entities/{entity_id}/archive", json={})
    r = client.post(f"/api/entities/{entity_id}/entries", json={"scope": "general", "section_id": "overview", "body": "x"})
    assert r.status_code == 400


def test_entry_archive_and_history(client, entity_id):
    [entry] = add(client, entity_id, scope="general", body="x")
    client.post(f"/api/entries/{entry['id']}/archive", json={"reason": "wrong section"})
    assert client.get(f"/api/entities/{entity_id}/entries").json() == []
    archived = client.get(f"/api/entities/{entity_id}/entries", params={"include_archived": True}).json()
    assert archived[0]["archive_reason"] == "wrong section"


def test_entries_are_ordered_by_section(client, entity_id):
    add(client, entity_id, scope="general", section_id="dosage", body="d")
    add(client, entity_id, scope="general", section_id="overview", body="o")
    add(client, entity_id, scope="personal", section_id="overview", body="p")
    listed = client.get(f"/api/entities/{entity_id}/entries").json()
    assert [(e["section_id"], e["scope"]) for e in listed] == [
        ("overview", "general"), ("overview", "personal"), ("dosage", "general")]


def test_ai_generated_entries_cannot_start_verified(conn):
    from server.services import entities
    e = entities.create_entity(conn, entity_type_id="drug", name="X")
    with pytest.raises(Invalid, match="AI-generated"):
        entries.create_entry(conn, entity_id=e["id"], scope="general", section_id="overview", body="x",
                             status_code="verified", origin="ai")
    [proposal] = entries.create_entry(conn, entity_id=e["id"], scope="general", section_id="overview", body="x",
                                      status_code="proposed", origin="ai")
    assert proposal["origin"] == "ai"
