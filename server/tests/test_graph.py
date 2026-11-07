"""M10: graph neighbourhoods (never the whole database)."""
import time

import pytest


@pytest.fixture
def hub(client):
    """Paracetamol linked to 60 other entities, plus one archived link and one archived neighbour."""
    make = lambda name, t="concept": client.post("/api/entities", json={"entity_type_id": t, "name": name,
                                                                         "allow_duplicate": True}).json()["id"]
    para = make("Paracetamol", "drug")
    others = [make(f"Concept {i:03d}") for i in range(60)]
    link = lambda s, t, kind="ASSOCIATED_WITH", **kw: client.post("/api/relationships", json={
        "source_entity_id": s, "target_entity_id": t, "relationship_type_id": kind, **kw}).json()["id"]
    for o in others:
        link(para, o)
    cox = make("COX", "enzyme")
    link(para, cox, "INHIBITS", status_code="verified")
    gone = make("Archived neighbour")
    link(para, gone)
    client.post(f"/api/entities/{gone}/archive", json={})
    old = make("Old link target")
    client.post(f"/api/relationships/{link(para, old)}/archive", json={})
    lecture_only = make("Lecture-only neighbour")
    link(lecture_only, para, scope="lecture")
    return {"para": para, "others": others, "cox": cox}


def expand(client, entity_id, **body):
    r = client.post("/api/graph/expand", json={"entity_id": entity_id, **body})
    assert r.status_code == 200, r.text
    return r.json()


def test_first_view_is_limited(client, hub):
    first = expand(client, hub["para"])
    assert len(first["neighbors"]) == 25 and first["remaining"] == 62 - 25  # 60 + COX + lecture-only
    assert first["neighbors"][0]["name"] == "COX"  # verified links come first


def test_archived_items_never_appear(client, hub):
    everything = expand(client, hub["para"], limit=100)["neighbors"]
    everything += expand(client, hub["para"], limit=100, exclude=[n["id"] for n in everything])["neighbors"]
    everything += expand(client, hub["para"], limit=100, exclude=[n["id"] for n in everything])["neighbors"]
    names = {n["name"] for n in everything}
    assert len(names) == 62 and "Archived neighbour" not in names and "Old link target" not in names


def test_expanding_again_skips_what_is_on_screen(client, hub):
    first = expand(client, hub["para"])
    shown = [n["id"] for n in first["neighbors"]]
    second = expand(client, hub["para"], exclude=shown)
    assert not {n["id"] for n in second["neighbors"]} & set(shown)
    assert second["remaining"] == first["remaining"] - 25


def test_filters_by_type_and_scope(client, hub):
    assert [n["name"] for n in expand(client, hub["para"], types=["INHIBITS"])["neighbors"]] == ["COX"]
    lecture = expand(client, hub["para"], scopes=["lecture"])
    assert [n["name"] for n in lecture["neighbors"]] == ["Lecture-only neighbour"]


def test_view_returns_edges_among_visible_nodes_and_hidden_counts(client, hub):
    ids = [hub["para"], hub["cox"], hub["others"][0]]
    view = client.post("/api/graph/view", json={"ids": ids}).json()
    assert sorted(e["label"] for e in view["edges"]) == ["associated with", "inhibits"]
    assert view["hidden"][hub["para"]] == 62 - 2  # two of its neighbours are on screen
    assert hub["cox"] not in view["hidden"]  # COX has no other neighbours


def test_too_many_nodes_is_refused(client, hub):
    assert client.post("/api/graph/view", json={"ids": ["x"] * 501}).status_code == 422


def test_neighbourhood_is_fast(client, hub):
    start = time.perf_counter()
    expand(client, hub["para"])
    client.post("/api/graph/view", json={"ids": [hub["para"], *hub["others"][:25]]})
    assert time.perf_counter() - start < 0.2
