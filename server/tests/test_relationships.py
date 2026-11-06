"""M4: typed relationships with conditions."""
import pytest


@pytest.fixture
def ids(client):
    make = lambda name, t: client.post("/api/entities", json={"entity_type_id": t, "name": name}).json()["id"]
    return {"para": make("Paracetamol", "drug"), "cox": make("Cyclooxygenase", "enzyme"),
            "fever": make("Fever", "clinical_condition")}


def link(client, source, target, type_id, **extra):
    r = client.post("/api/relationships", json={"source_entity_id": source, "target_entity_id": target,
                                                "relationship_type_id": type_id, **extra})
    assert r.status_code == 201, r.text
    return r.json()


def listed(client, entity_id, **params):
    return client.get(f"/api/entities/{entity_id}/relationships", params=params).json()


def test_relationship_reads_correctly_from_both_sides(client, ids):
    link(client, ids["para"], ids["cox"], "INHIBITS", description="Mainly in the CNS")
    [from_drug] = listed(client, ids["para"])
    [from_enzyme] = listed(client, ids["cox"])
    assert (from_drug["label"], from_drug["other_name"], from_drug["direction"]) == ("inhibits", "Cyclooxygenase", "out")
    assert (from_enzyme["label"], from_enzyme["other_name"], from_enzyme["direction"]) == ("inhibited by", "Paracetamol", "in")


def test_same_pair_twice_with_different_conditions(client, ids):
    adults = link(client, ids["para"], ids["fever"], "TREATS",
                  contexts=[{"context_kind_id": "population", "value_text": "adults"}])
    children = link(client, ids["para"], ids["fever"], "TREATS",
                    contexts=[{"context_kind_id": "population", "value_text": "children ≥ 3 months"}])
    assert adults["id"] != children["id"]
    found = listed(client, ids["para"])
    assert sorted(r["contexts"][0]["value_text"] for r in found) == ["adults", "children ≥ 3 months"]
    assert found[0]["contexts"][0]["kind_label"] == "Population"


def test_archiving_a_relationship_leaves_entities_untouched(client, ids):
    rel = link(client, ids["para"], ids["cox"], "INHIBITS")
    client.post(f"/api/relationships/{rel['id']}/archive", json={"reason": "outdated"})
    assert listed(client, ids["para"]) == []
    assert listed(client, ids["para"], include_archived=True)[0]["archive_reason"] == "outdated"
    for key in ("para", "cox"):
        entity = client.get(f"/api/entities/{ids[key]}").json()
        assert entity["version"] == 1 and entity["archived_at"] is None


def test_conditions_are_part_of_history(client, ids):
    rel = link(client, ids["para"], ids["fever"], "TREATS")
    client.post(f"/api/relationships/{rel['id']}/contexts", json={"context_kind_id": "jurisdiction", "value_text": "TH"})
    context_id = client.get(f"/api/relationships/{rel['id']}").json()["contexts"][0]["id"]
    client.post(f"/api/relationships/{rel['id']}/contexts/{context_id}/remove")
    history = client.get(f"/api/relationships/{rel['id']}/revisions").json()
    assert [h["version"] for h in history] == [3, 2, 1]
    assert history[0]["reason"] == "Removed condition: jurisdiction = TH"
    assert history[1]["snapshot"]["contexts"][0]["value_text"] == "TH"  # the removed condition is still recorded
    assert client.get(f"/api/relationships/{rel['id']}").json()["contexts"] == []


def test_edit_relationship_description(client, ids):
    rel = link(client, ids["para"], ids["cox"], "INHIBITS", description="old")
    updated = client.patch(f"/api/relationships/{rel['id']}", json={"description": "new", "reason": "textbook"}).json()
    assert updated["version"] == 2
    assert client.get(f"/api/relationships/{rel['id']}/revisions").json()[1]["snapshot"]["description"] == "old"


def test_cannot_link_to_archived_entity_or_unknown_type(client, ids):
    client.post(f"/api/entities/{ids['fever']}/archive", json={})
    r = client.post("/api/relationships", json={"source_entity_id": ids["para"], "target_entity_id": ids["fever"],
                                                "relationship_type_id": "TREATS"})
    assert r.status_code == 400
    r = client.post("/api/relationships", json={"source_entity_id": ids["para"], "target_entity_id": ids["cox"],
                                                "relationship_type_id": "NOT_A_TYPE"})
    assert r.status_code == 400


def test_custom_relationship_type(client, ids):
    created = client.post("/api/relationship-types", json={"label": "prodrug of", "inverse_label": "active form of"})
    assert created.status_code == 201 and created.json()["id"] == "PRODRUG_OF"
    assert client.post("/api/relationship-types", json={"label": "Prodrug of"}).status_code == 400  # duplicate
    link(client, ids["para"], ids["cox"], "PRODRUG_OF")


def test_conditions_on_knowledge_entries(client, ids):
    [entry] = client.post(f"/api/entities/{ids['para']}/entries",
                          json={"scope": "general", "section_id": "dosage", "body": "500–1000 mg every 4–6 h"}).json()
    client.post(f"/api/entries/{entry['id']}/contexts", json={"context_kind_id": "population", "value_text": "adults"})
    fetched = client.get(f"/api/entries/{entry['id']}").json()
    assert fetched["version"] == 2 and fetched["contexts"][0]["value_text"] == "adults"
