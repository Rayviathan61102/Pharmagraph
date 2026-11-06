"""End-to-end check of the spec Section 21 criteria covered by milestones M1-M8,
using only the HTTP API, the same way the interface does."""


def test_mvp_criteria_up_to_m8(client):
    post = lambda path, body=None: client.post(f"/api{path}", json=body or {})

    # 1. Create a scientific entity
    para = post("/entities", {"entity_type_id": "drug", "name": "Paracetamol",
                              "aliases": [{"alias": "Acetaminophen"}, {"alias": "พาราเซตามอล"}]}).json()
    cox = post("/entities", {"entity_type_id": "enzyme", "name": "Cyclooxygenase"}).json()

    # 2 + 3. General information, and separate lecture-specific information on the same entity
    lecture = post("/lectures", {"title": "Analgesics", "course_code": "PHA301"}).json()
    general, lecture_entry = post(f"/entities/{para['id']}/entries", {
        "scope": "both", "section_id": "mechanism", "body": "Central COX inhibition.",
        "lecture_id": lecture["id"], "lecture_body": "Slide 12: central analgesic."}).json()
    assert (general["scope"], lecture_entry["scope"]) == ("general", "lecture")

    # 4. Connect two entities with a typed relationship (with a condition)
    rel = post("/relationships", {"source_entity_id": para["id"], "target_entity_id": cox["id"],
                                  "relationship_type_id": "INHIBITS",
                                  "contexts": [{"context_kind_id": "clinical_setting", "value_text": "CNS"}]}).json()

    # 5. Attach a source to a specific claim / relationship
    book = post("/sources", {"source_type": "textbook", "title": "Goodman & Gilman", "edition": "14"}).json()
    post("/evidence", {"source_id": book["id"], "relationship_id": rel["id"], "locator": "p. 601"})
    post("/evidence", {"source_id": book["id"], "knowledge_entry_id": general["id"], "locator": "p. 600"})

    # 6. Search for and retrieve the entity (by alias, and in Thai)
    for q in ("acetamino", "ราเซต"):
        assert [h["id"] for h in client.get("/api/search", params={"q": q}).json()] == [para["id"]]

    # 7. Navigate through the hierarchical sidebar
    pharm = post("/categories", {"name": "Pharmacology"}).json()
    analgesics = post("/categories", {"name": "Analgesics", "parent_id": pharm["id"]}).json()
    post(f"/categories/{analgesics['id']}/entities", {"entity_id": para["id"]})
    top = client.get("/api/categories/children").json()
    level2 = client.get("/api/categories/children", params={"parent_id": top["categories"][0]["id"]}).json()
    level3 = client.get("/api/categories/children", params={"parent_id": level2["categories"][0]["id"]}).json()
    assert [e["name"] for e in level3["entities"]] == ["Paracetamol"]

    # M8: the detail page data. Sections in spec order, claims with sources, history with reasons.
    client.patch(f"/api/entries/{general['id']}", json={"body": "Central COX inhibition (weak peripheral).",
                                                        "reason": "added nuance"})
    post(f"/entries/{general['id']}/status", {"status_code": "verified", "notes": "Checked G&G p. 600"})
    entries = client.get(f"/api/entities/{para['id']}/entries").json()
    assert [e["evidence"][0]["locator"] for e in entries if e["scope"] == "general"] == ["p. 600"]
    [relationship] = client.get(f"/api/entities/{para['id']}/relationships").json()
    assert relationship["evidence"][0]["locator"] == "p. 601" and relationship["contexts"][0]["value_text"] == "CNS"
    history = client.get(f"/api/entries/{general['id']}/revisions").json()
    assert [(h["change_kind"], h["reason"]) for h in history] == [
        ("status_change", "Checked G&G p. 600"), ("update", "added nuance"), ("create", None)]
    assert history[-1]["snapshot"]["body"] == "Central COX inhibition."  # the original text is kept
    # the lecture version was never touched by any of this
    assert client.get(f"/api/entries/{lecture_entry['id']}").json()["version"] == 1
