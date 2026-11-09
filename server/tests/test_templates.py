"""Entity templates (new-entity boxes, custom templates) and images."""
PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 32


def sections_of(client, type_id):
    data = client.get("/api/lookups").json()
    return [t["section_id"] for t in data["type_sections"] if t["entity_type_id"] == type_id]


def test_built_in_templates_have_the_requested_topics_in_order(client):
    assert sections_of(client, "enzyme") == ["image", "classification", "biological_function", "location", "substrates",
                                             "inhibitors", "inducers", "related_pathway"]
    assert sections_of(client, "disease") == ["definition", "etiology", "pathophysiology", "clinical_manifestation",
                                              "diagnosis", "differential_diagnosis", "treatment", "monitoring", "caution",
                                              "complications"]
    assert sections_of(client, "dosage_form")[:2] == ["definition", "classification"]
    assert {"mechanism", "chemistry", "pharmacokinetics", "half_life", "efficacy"} <= set(sections_of(client, "drug"))


def test_new_entity_saves_only_the_boxes_filled_in(client):
    e = client.post("/api/entities", json={"entity_type_id": "disease", "name": "Gout", "entries": [
        {"section_id": "definition", "body": "Urate crystal arthritis"}]}).json()
    [entry] = client.get(f"/api/entities/{e['id']}/entries").json()
    assert (entry["section_id"], entry["scope"], entry["version"]) == ("definition", "general", 1)
    empty = client.post("/api/entities", json={"entity_type_id": "disease", "name": "Lupus"}).json()
    assert client.get(f"/api/entities/{empty['id']}/entries").json() == []


def test_box_scope_can_be_lecture_or_both(client):
    e = client.post("/api/entities", json={"entity_type_id": "disease", "name": "Gout", "entries_scope": "both", "entries": [
        {"section_id": "definition", "body": "x"}]}).json()
    assert sorted(x["scope"] for x in client.get(f"/api/entities/{e['id']}/entries").json()) == ["general", "lecture"]


def test_entity_and_boxes_save_together_or_not_at_all(client):
    r = client.post("/api/entities", json={"entity_type_id": "disease", "name": "Gout", "entries": [
        {"section_id": "no_such_topic", "body": "x"}]})
    assert r.status_code == 400
    assert client.get("/api/entities", params={"include_archived": True}).json() == []


def test_custom_template_with_a_new_topic(client):
    topic = client.post("/api/sections", json={"label": "Mode of transmission"}).json()
    assert client.post("/api/sections", json={"label": "mode of TRANSMISSION"}).json()["id"] == topic["id"]
    t = client.post("/api/templates", json={"label": "Vaccine", "sections": [topic["id"], "overview"]}).json()
    assert sections_of(client, t["id"]) == [topic["id"], "overview"]
    assert client.post("/api/templates", json={"label": "vaccine"}).status_code == 400
    client.patch(f"/api/templates/{t['id']}", json={"sections": ["overview", topic["id"]]})
    assert sections_of(client, t["id"]) == ["overview", topic["id"]]


def test_template_in_use_or_built_in_cannot_be_deleted(client):
    t = client.post("/api/templates", json={"label": "Vaccine"}).json()
    e = client.post("/api/entities", json={"entity_type_id": t["id"], "name": "BCG"}).json()
    assert client.post(f"/api/templates/{t['id']}/archive").status_code == 400
    assert client.post("/api/templates/drug/archive").status_code == 400
    client.patch(f"/api/entities/{e['id']}", json={"entity_type_id": "concept"})
    assert client.post(f"/api/templates/{t['id']}/archive").status_code == 200
    assert all(x["id"] != t["id"] for x in client.get("/api/lookups").json()["entity_types"])


def test_image_upload_view_and_archive(client):
    e = client.post("/api/entities", json={"entity_type_id": "enzyme", "name": "CYP3A4"}).json()
    r = client.post(f"/api/entities/{e['id']}/images", content=PNG, headers={"Content-Type": "image/jpeg"})
    assert r.status_code == 201 and r.json()["media_type"] == "image/png"  # from the bytes, not the header
    image = client.get(f"/api/images/{r.json()['id']}")
    assert image.content == PNG and image.headers["content-type"] == "image/png"
    client.post(f"/api/images/{r.json()['id']}/archive")
    assert client.get(f"/api/entities/{e['id']}/images").json() == []


def test_bad_images_are_refused(client):
    e = client.post("/api/entities", json={"entity_type_id": "enzyme", "name": "CYP3A4"}).json()
    svg = b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"
    assert client.post(f"/api/entities/{e['id']}/images", content=svg).status_code == 400
    assert client.post(f"/api/entities/{e['id']}/images", content=PNG + b"\0" * (8 * 1024 * 1024)).status_code == 400
