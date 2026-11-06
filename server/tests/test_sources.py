"""M5: sources, evidence on specific claims, statuses and reviews."""
import sqlite3

import pytest

from server.services import entities, entries, sources
from server.services.errors import Invalid


@pytest.fixture
def claims(client):
    make = lambda name, t: client.post("/api/entities", json={"entity_type_id": t, "name": name}).json()["id"]
    para, cox, fever = make("Paracetamol", "drug"), make("Cyclooxygenase", "enzyme"), make("Fever", "disease")
    rel = lambda target, t: client.post("/api/relationships", json={
        "source_entity_id": para, "target_entity_id": target, "relationship_type_id": t}).json()["id"]
    [entry] = client.post(f"/api/entities/{para}/entries",
                          json={"scope": "general", "section_id": "mechanism", "body": "Central COX inhibition"}).json()
    return {"para": para, "inhibits": rel(cox, "INHIBITS"), "treats": rel(fever, "TREATS"), "entry": entry["id"]}


def textbook(client, title="Goodman & Gilman's Pharmacological Basis of Therapeutics", **extra):
    r = client.post("/api/sources", json={"source_type": "textbook", "title": title, "edition": "14", **extra})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def cite(client, source_id, **target_and_fields):
    r = client.post("/api/evidence", json={"source_id": source_id, **target_and_fields})
    assert r.status_code == 201, r.text
    return r.json()


def relationships_by_type(client, entity_id):
    return {r["relationship_type_id"]: r for r in client.get(f"/api/entities/{entity_id}/relationships").json()}


def test_source_attaches_to_one_relationship_only(client, claims):
    book = textbook(client)
    cite(client, book, relationship_id=claims["inhibits"], locator="p. 601", evidence_type="textbook_statement")
    rels = relationships_by_type(client, claims["para"])
    assert [(e["source_title"][:8], e["locator"]) for e in rels["INHIBITS"]["evidence"]] == [("Goodman ", "p. 601")]
    assert rels["TREATS"]["evidence"] == []
    assert client.get(f"/api/entries/{claims['entry']}").json()["evidence"] == []


def test_one_claim_two_sources(client, claims):
    cite(client, textbook(client), knowledge_entry_id=claims["entry"], locator="p. 601")
    cite(client, textbook(client, title="Rang & Dale's Pharmacology"), knowledge_entry_id=claims["entry"])
    assert len(client.get(f"/api/entries/{claims['entry']}").json()["evidence"]) == 2


def test_evidence_needs_exactly_one_claim(client, claims):
    book = textbook(client)
    assert client.post("/api/evidence", json={"source_id": book}).status_code == 400
    both = {"source_id": book, "knowledge_entry_id": claims["entry"], "relationship_id": claims["inhibits"]}
    assert client.post("/api/evidence", json=both).status_code == 400


def test_contradicting_evidence_suggests_disputed_and_review_is_recorded(client, claims):
    ev = cite(client, textbook(client, title="New 2026 guideline"), relationship_id=claims["treats"],
              stance="contradicts")
    assert ev["suggest_disputed"] is True
    r = client.post(f"/api/relationships/{claims['treats']}/status",
                    json={"status_code": "disputed", "notes": "Contradicted by the 2026 guideline"})
    assert r.json()["status_code"] == "disputed"
    [review] = client.get(f"/api/relationships/{claims['treats']}/reviews").json()
    assert (review["from_status_code"], review["to_status_code"]) == ("proposed", "disputed")
    history = client.get(f"/api/relationships/{claims['treats']}/revisions").json()
    assert (history[0]["change_kind"], history[0]["reason"]) == ("status_change", "Contradicted by the 2026 guideline")
    # once disputed, further contradicting evidence no longer needs the prompt
    assert cite(client, textbook(client), relationship_id=claims["treats"], stance="contradicts")["suggest_disputed"] is False


def test_status_change_needs_a_reason(client, claims):
    r = client.post(f"/api/entries/{claims['entry']}/status", json={"status_code": "verified", "notes": "  "})
    assert r.status_code == 400


def test_review_without_change_keeps_version(client, claims):
    client.post(f"/api/entries/{claims['entry']}/status", json={"status_code": "verified", "notes": "Checked G&G p.601"})
    r = client.post(f"/api/entries/{claims['entry']}/status", json={"status_code": "verified", "notes": "Re-checked 2027"})
    assert r.json()["version"] == 2  # create + one real status change
    assert len(client.get(f"/api/entries/{claims['entry']}/reviews").json()) == 2


def test_entity_status_can_be_reviewed_too(client, claims):
    r = client.post(f"/api/entities/{claims['para']}/status", json={"status_code": "verified", "notes": "Identity checked"})
    assert r.json()["status_code"] == "verified"


def test_ai_content_needs_a_human_to_verify(conn):
    e = entities.create_entity(conn, entity_type_id="drug", name="X")
    [proposal] = entries.create_entry(conn, entity_id=e["id"], scope="general", section_id="overview", body="x",
                                      origin="ai")
    with pytest.raises(Invalid, match="Only you"):
        sources.change_status(conn, "knowledge_entry", proposal["id"], "verified", "looks right", reviewed_by="ai")
    verified = sources.change_status(conn, "knowledge_entry", proposal["id"], "verified", "checked against G&G")
    assert verified["status_code"] == "verified"


def test_cannot_cite_archived_source_or_delete_one(client, claims, conn):
    book = textbook(client)
    client.post(f"/api/sources/{book}/archive")
    assert client.post("/api/evidence", json={"source_id": book, "knowledge_entry_id": claims["entry"]}).status_code == 400
    with pytest.raises(sqlite3.IntegrityError, match="never deleted"):
        conn.execute("DELETE FROM source WHERE id = ?", (book,))


def test_archived_evidence_is_hidden(client, claims):
    ev = cite(client, textbook(client), knowledge_entry_id=claims["entry"])
    client.post(f"/api/evidence/{ev['id']}/archive")
    assert client.get(f"/api/entries/{claims['entry']}").json()["evidence"] == []


def test_source_search_and_edit(client):
    book = textbook(client)
    assert [s["id"] for s in client.get("/api/sources", params={"q": "goodman"}).json()] == [book]
    updated = client.patch(f"/api/sources/{book}", json={"edition": "15", "publication_date": "2026"}).json()
    assert (updated["edition"], updated["title"][:7]) == ("15", "Goodman")
