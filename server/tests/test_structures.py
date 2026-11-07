"""Chemical structures, highlighted features, and metabolites."""
import sqlite3

import pytest

EE = "C#C[C@]1(O)CC[C@H]2[C@@H]3CCc4cc(O)ccc4[C@H]3CC[C@@]21C"  # ethinyl estradiol


@pytest.fixture
def ee(client):
    entity = client.post("/api/entities", json={"entity_type_id": "drug", "name": "Ethinyl estradiol"}).json()
    s = client.post(f"/api/entities/{entity['id']}/structures", json={
        "original_smiles": EE, "canonical_smiles": EE, "canonicalizer": "RDKit.js 2026.09.2",
        "molecular_formula": "C20H24O2", "molecular_weight": 296.41}).json()
    return {"entity": entity, "structure": s}


def note(client, structure_id, **body):
    r = client.post(f"/api/structures/{structure_id}/annotations",
                    json={"atom_indices": [0, 1], "note": "17α-ethynyl group: blocks metabolism, so it works orally",
                          **body})
    assert r.status_code == 201, r.text
    return r.json()


def test_structure_is_stored_and_listed(client, ee):
    [s] = client.get(f"/api/entities/{ee['entity']['id']}/structures").json()
    assert (s["original_smiles"], s["molecular_formula"], s["entity_name"]) == (EE, "C20H24O2", "Ethinyl estradiol")


def test_highlight_with_note(client, ee):
    a = note(client, ee["structure"]["id"])
    assert a["atom_indices"] == [0, 1] and a["status_code"] == "proposed"
    assert client.get(f"/api/structures/{ee['structure']['id']}").json()["annotations"][0]["id"] == a["id"]


def test_editing_a_note_keeps_the_old_version(client, ee):
    first = note(client, ee["structure"]["id"])
    second = client.patch(f"/api/annotations/{first['id']}", json={"note": "Better wording", "atom_indices": [0, 1, 2]}).json()
    assert second["replaces_id"] == first["id"] and second["color"] == first["color"]
    [shown] = client.get(f"/api/structures/{ee['structure']['id']}").json()["annotations"]
    assert shown["note"] == "Better wording" and shown["atom_indices"] == [0, 1, 2]
    chain = client.get(f"/api/annotations/{second['id']}/history").json()
    assert [c["note"] for c in chain] == ["Better wording", first["note"]]
    assert client.patch(f"/api/annotations/{first['id']}", json={"note": "x"}).status_code == 400  # old version is closed


def test_archived_note_and_structure_are_hidden_not_deleted(client, ee, conn):
    a = note(client, ee["structure"]["id"])
    client.post(f"/api/annotations/{a['id']}/archive", json={"reason": "wrong atoms"})
    assert client.get(f"/api/structures/{ee['structure']['id']}").json()["annotations"] == []
    client.post(f"/api/structures/{ee['structure']['id']}/archive", json={})
    assert client.get(f"/api/entities/{ee['entity']['id']}/structures").json() == []
    with pytest.raises(sqlite3.IntegrityError, match="never deleted"):
        conn.execute("DELETE FROM structure_annotation")


def test_note_needs_atoms_and_a_valid_colour(client, ee):
    sid = ee["structure"]["id"]
    assert client.post(f"/api/structures/{sid}/annotations", json={"atom_indices": [], "note": "x"}).status_code == 422
    assert client.post(f"/api/structures/{sid}/annotations",
                       json={"atom_indices": [0], "note": "x", "color": "red; x"}).status_code == 422


def test_metabolite_with_activity_enzyme_and_pathway(client):
    make = lambda name, t: client.post("/api/entities", json={"entity_type_id": t, "name": name}).json()["id"]
    para, napqi, cyp = make("Paracetamol", "drug"), make("NAPQI", "metabolite"), make("CYP2E1", "enzyme")
    r = client.post("/api/relationships", json={
        "source_entity_id": para, "target_entity_id": napqi, "relationship_type_id": "HAS_METABOLITE",
        "contexts": [{"context_kind_id": "metabolite_activity", "value_text": "hepatotoxic"},
                     {"context_kind_id": "formed_by", "value_entity_id": cyp},
                     {"context_kind_id": "metabolic_pathway", "value_text": "N-hydroxylation"}]})
    assert r.status_code == 201, r.text
    [m] = client.get(f"/api/entities/{para}/relationships").json()
    found = {c["context_kind_id"]: c["value_text"] or c["value_entity_name"] for c in m["contexts"]}
    assert (m["label"], m["other_name"]) == ("has metabolite", "NAPQI")
    assert found == {"metabolite_activity": "hepatotoxic", "formed_by": "CYP2E1", "metabolic_pathway": "N-hydroxylation"}
    [back] = client.get(f"/api/entities/{napqi}/relationships").json()
    assert back["label"] == "metabolite of"


def test_editing_metabolite_details_is_one_version(client):
    make = lambda name, t: client.post("/api/entities", json={"entity_type_id": t, "name": name}).json()["id"]
    para, gluc = make("Paracetamol", "drug"), make("Paracetamol glucuronide", "metabolite")
    rel = client.post("/api/relationships", json={
        "source_entity_id": para, "target_entity_id": gluc, "relationship_type_id": "HAS_METABOLITE",
        "contexts": [{"context_kind_id": "metabolite_activity", "value_text": "active"},
                     {"context_kind_id": "population", "value_text": "adults"}]}).json()
    kinds = ["metabolite_activity", "formed_by", "metabolic_pathway", "metabolite_share"]
    r = client.put(f"/api/relationships/{rel['id']}/contexts", json={"kinds": kinds, "reason": "corrected", "contexts": [
        {"context_kind_id": "metabolite_activity", "value_text": "inactive"},
        {"context_kind_id": "metabolite_share", "value_text": "Major"},
        {"context_kind_id": "metabolite_share", "value_text": "55%"}]})
    assert r.status_code == 200, r.text
    after = client.get(f"/api/relationships/{rel['id']}").json()
    assert after["version"] == 2  # one edit = one version
    assert sorted(c["value_text"] for c in after["contexts"]) == ["55%", "Major", "adults", "inactive"]  # others kept
    history = client.get(f"/api/relationships/{rel['id']}/revisions").json()
    assert history[0]["reason"] == "corrected"
    assert [c["value_text"] for c in history[1]["snapshot"]["contexts"]] == ["active", "adults"]
    stray = client.put(f"/api/relationships/{rel['id']}/contexts", json={"kinds": ["formed_by"], "contexts": [
        {"context_kind_id": "population", "value_text": "x"}]})
    assert stray.status_code == 400
