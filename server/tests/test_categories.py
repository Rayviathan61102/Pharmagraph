"""M7: the hierarchical sidebar (categories)."""
import pytest


def cat(client, name, parent=None):
    r = client.post("/api/categories", json={"name": name, "parent_id": parent})
    assert r.status_code == 201, r.text
    return r.json()["id"]


@pytest.fixture
def tree(client):
    pharm = cat(client, "Pharmacology")
    antimicrobials = cat(client, "Antimicrobials", pharm)
    antivirals = cat(client, "Antivirals", antimicrobials)
    hiv = cat(client, "HIV", antivirals)
    micro = cat(client, "Microbiology")
    return {"pharm": pharm, "antimicrobials": antimicrobials, "antivirals": antivirals, "hiv": hiv, "micro": micro}


def test_entity_in_two_categories_exists_once(client, tree, conn):
    azt = client.post("/api/entities", json={"entity_type_id": "drug", "name": "Zidovudine"}).json()["id"]
    for c in ("antivirals", "hiv"):
        client.post(f"/api/categories/{tree[c]}/entities", json={"entity_id": azt})
    client.post(f"/api/categories/{tree['hiv']}/entities", json={"entity_id": azt})  # adding twice is harmless
    for c in ("antivirals", "hiv"):
        assert [e["name"] for e in client.get("/api/categories/children", params={"parent_id": tree[c]}).json()["entities"]] == ["Zidovudine"]
    assert conn.execute("SELECT COUNT(*) FROM entity WHERE name = 'Zidovudine'").fetchone()[0] == 1
    paths = [c["path"] for c in client.get(f"/api/entities/{azt}/categories").json()]
    assert paths == ["Pharmacology › Antimicrobials › Antivirals", "Pharmacology › Antimicrobials › Antivirals › HIV"]


def test_tree_loads_one_level_at_a_time_with_counts(client, tree):
    top = client.get("/api/categories/children").json()
    assert [(c["name"], c["child_count"]) for c in top["categories"]] == [("Microbiology", 0), ("Pharmacology", 1)]
    assert top["entities"] == []
    level2 = client.get("/api/categories/children", params={"parent_id": tree["pharm"]}).json()
    assert [c["name"] for c in level2["categories"]] == ["Antimicrobials"]


def test_moving_inside_itself_is_refused(client, tree):
    for target in ("hiv", "antimicrobials"):  # its own grandchild, and itself
        r = client.patch(f"/api/categories/{tree['antimicrobials']}", json={"parent_id": tree[target]})
        assert r.status_code == 400
    ok = client.patch(f"/api/categories/{tree['antivirals']}", json={"parent_id": tree["micro"]})
    assert ok.status_code == 200
    paths = [c["path"] for c in client.get("/api/categories").json()]
    assert "Microbiology › Antivirals › HIV" in paths


def test_move_to_top_level_and_rename(client, tree):
    client.patch(f"/api/categories/{tree['hiv']}", json={"parent_id": None, "name": "HIV / AIDS"})
    top = [c["name"] for c in client.get("/api/categories/children").json()["categories"]]
    assert "HIV / AIDS" in top


def test_archived_category_disappears_from_tree(client, tree):
    client.post(f"/api/categories/{tree['micro']}/archive")
    assert [c["name"] for c in client.get("/api/categories/children").json()["categories"]] == ["Pharmacology"]
    assert client.post("/api/categories", json={"name": "x", "parent_id": tree["micro"]}).status_code == 400


def test_deleting_a_category_takes_its_subfolders_but_keeps_entities(client, tree):
    azt = client.post("/api/entities", json={"entity_type_id": "drug", "name": "Zidovudine"}).json()["id"]
    client.post(f"/api/categories/{tree['hiv']}/entities", json={"entity_id": azt})
    client.post(f"/api/categories/{tree['micro']}/entities", json={"entity_id": azt})
    client.post(f"/api/categories/{tree['hiv']}/archive")  # deleted earlier, on its own
    client.post(f"/api/categories/{tree['antimicrobials']}/archive")
    paths = [c["path"] for c in client.get("/api/categories").json()]
    assert paths == ["Microbiology", "Pharmacology"]  # no orphaned subfolders left behind
    assert client.get(f"/api/entities/{azt}").json()["archived_at"] is None
    assert [c["path"] for c in client.get(f"/api/entities/{azt}/categories").json()] == ["Microbiology"]
    client.post(f"/api/categories/{tree['antimicrobials']}/unarchive")
    paths = [c["path"] for c in client.get("/api/categories").json()]
    assert "Pharmacology › Antimicrobials › Antivirals" in paths
    assert not any("HIV" in p for p in paths)  # it was deleted separately, so it stays deleted


def test_remove_entity_from_category(client, tree):
    azt = client.post("/api/entities", json={"entity_type_id": "drug", "name": "Zidovudine"}).json()["id"]
    client.post(f"/api/categories/{tree['hiv']}/entities", json={"entity_id": azt})
    client.post(f"/api/categories/{tree['hiv']}/entities/{azt}/remove")
    assert client.get(f"/api/entities/{azt}/categories").json() == []
    assert client.get(f"/api/entities/{azt}").status_code == 200  # the entity itself is untouched
