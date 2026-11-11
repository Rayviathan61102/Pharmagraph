"""Home page summary and quiz cards (read-only helpers built from existing data)."""
import pytest


@pytest.fixture
def base(client):
    def entity(name, type_id="drug"):
        return client.post("/api/entities", json={"entity_type_id": type_id, "name": name}).json()["id"]

    para, ibu, fever, pain = entity("Paracetamol"), entity("Ibuprofen"), entity("Fever", "disease"), entity("Pain", "disease")
    for target in (fever, pain):
        client.post("/api/relationships", json={"source_entity_id": para, "target_entity_id": target,
                                                "relationship_type_id": "TREATS"})
    client.post("/api/relationships", json={"source_entity_id": ibu, "target_entity_id": fever,
                                            "relationship_type_id": "TREATS"})
    [entry] = client.post(f"/api/entities/{para}/entries", json={
        "scope": "general", "section_id": "mechanism", "body": "Central COX inhibition", "title": "COX",
        "status_code": "needs_review"}).json()
    drugs = client.post("/api/categories", json={"name": "Drugs"}).json()["id"]
    analgesics = client.post("/api/categories", json={"name": "Analgesics", "parent_id": drugs}).json()["id"]
    client.post(f"/api/categories/{analgesics}/entities", json={"entity_id": para})
    return {"para": para, "ibu": ibu, "entry": entry["id"], "drugs": drugs}


def test_home_counts_and_attention_lists(client, base):
    client.post("/api/notes", json={"body": "inbox note"})
    home = client.get("/api/home").json()
    assert home["counts"] == {"entities": 4, "entries": 1, "verified_entries": 0, "relationships": 3,
                              "unsourced": 1, "inbox": 1}
    assert [(e["entity_name"], e["section_label"]) for e in home["needs_review"]] == [("Paracetamol", "Mechanism of action")]
    assert [e["id"] for e in home["unsourced"]] == [base["entry"]]
    assert len(home["recent"]) == 4


def test_quiz_makes_cards_from_relationships_and_entries(client, base):
    cards = {c["id"]: c for c in client.get("/api/quiz", params={"limit": 50}).json()}
    treats = cards[f"rel:{base['para']}:TREATS"]
    assert (treats["entity_name"], treats["prompt"], treats["answer"]) == ("Paracetamol", "treats …?", "- Fever\n- Pain")
    entry = cards[f"entry:{base['entry']}"]
    assert (entry["prompt"], entry["answer"]) == ("Mechanism of action: COX", "Central COX inhibition")
    assert len(cards) == 3  # Paracetamol treats, Ibuprofen treats, the entry
    assert len(client.get("/api/quiz", params={"limit": 2}).json()) == 2


def test_quiz_by_category_includes_subcategories_and_skips_archived(client, base):
    in_drugs = client.get("/api/quiz", params={"category_id": base["drugs"], "limit": 50}).json()
    assert {c["entity_name"] for c in in_drugs} == {"Paracetamol"}  # filed under Drugs > Analgesics
    client.post(f"/api/entries/{base['entry']}/archive", json={})
    assert [c["kind"] for c in client.get("/api/quiz", params={"category_id": base["drugs"]}).json()] == ["relationship"]
    assert client.get("/api/quiz", params={"category_id": "nope"}).status_code == 404
