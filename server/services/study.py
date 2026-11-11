"""Study helpers built only from what is already in the knowledge base: the home page summary, and
quiz cards. Nothing here changes any data."""
import json
import random

from . import history, notes
from .history import rows

SKIP_SECTIONS = ("image",)  # sections that hold no text to recall


def home(conn) -> dict:
    """Numbers and short "needs attention" lists for the start page."""
    count = lambda sql: conn.execute(sql).fetchone()[0]  # noqa: E731
    entry_list = """
        SELECT ke.id, ke.entity_id, e.name AS entity_name, s.label AS section_label, ke.status_code
        FROM knowledge_entry ke
        JOIN entity e ON e.id = ke.entity_id AND e.archived_at IS NULL
        JOIN knowledge_section s ON s.id = ke.section_id
        WHERE ke.archived_at IS NULL AND {where}
        ORDER BY ke.updated_at DESC LIMIT 8"""
    # A general (scientific) entry with no source attached yet. Lecture and personal entries need none.
    unsourced = """ke.scope = 'general' AND NOT EXISTS (
        SELECT 1 FROM evidence_link ev WHERE ev.knowledge_entry_id = ke.id AND ev.archived_at IS NULL)"""
    return {
        "counts": {
            "entities": count("SELECT count(*) FROM entity WHERE archived_at IS NULL"),
            "entries": count("SELECT count(*) FROM knowledge_entry WHERE archived_at IS NULL"),
            "verified_entries": count(
                "SELECT count(*) FROM knowledge_entry WHERE archived_at IS NULL AND status_code = 'verified'"),
            "relationships": count("SELECT count(*) FROM relationship WHERE archived_at IS NULL"),
            "unsourced": count(f"""SELECT count(*) FROM knowledge_entry ke
                JOIN entity e ON e.id = ke.entity_id AND e.archived_at IS NULL
                WHERE ke.archived_at IS NULL AND {unsourced}"""),
            "inbox": notes.inbox_count(conn),
        },
        "needs_review": rows(conn, entry_list.format(where="ke.status_code IN ('needs_review', 'disputed')")),
        "unsourced": rows(conn, entry_list.format(where=unsourced)),
        "recent": rows(conn, """
            SELECT e.id, e.name, t.label AS type_label, e.updated_at
            FROM entity e JOIN entity_type t ON t.id = e.entity_type_id
            WHERE e.archived_at IS NULL ORDER BY e.updated_at DESC LIMIT 6"""),
    }


def quiz(conn, category_id: str | None = None, limit: int = 10) -> list[dict]:
    """Up to `limit` random flashcards: half from relationships ("X treats ...?"), half from entries
    ("X - Mechanism of action"). With a category, only entities in it or in its subcategories."""
    where, params = "", []
    if category_id:
        history.get_row(conn, "category", category_id)  # 404 if it does not exist
        where = """ AND s.id IN (
            WITH RECURSIVE sub(id) AS (
                SELECT ? UNION ALL
                SELECT c.id FROM category c JOIN sub ON c.parent_id = sub.id WHERE c.archived_at IS NULL)
            SELECT entity_id FROM entity_category WHERE category_id IN (SELECT id FROM sub))"""
        params = [category_id]

    cards = []
    # One card per (entity, kind of relationship); the answer is every entity it points to.
    for r in rows(conn, f"""
            SELECT s.id AS entity_id, s.name AS entity_name, t.id AS type_id, t.label,
                   json_group_array(DISTINCT tg.name) AS answers
            FROM relationship r
            JOIN entity s ON s.id = r.source_entity_id AND s.archived_at IS NULL
            JOIN entity tg ON tg.id = r.target_entity_id AND tg.archived_at IS NULL
            JOIN relationship_type t ON t.id = r.relationship_type_id
            WHERE r.archived_at IS NULL {where}
            GROUP BY s.id, t.id ORDER BY random() LIMIT ?""", [*params, limit]):
        cards.append({
            "id": f"rel:{r['entity_id']}:{r['type_id']}", "kind": "relationship",
            "entity_id": r["entity_id"], "entity_name": r["entity_name"],
            "prompt": f"{r['label']} …?",
            "answer": "\n".join(f"- {name}" for name in sorted(json.loads(r["answers"]), key=str.lower)),
        })
    for e in rows(conn, f"""
            SELECT ke.id, s.id AS entity_id, s.name AS entity_name, sec.label AS section_label, ke.title, ke.body,
                   ke.status_code
            FROM knowledge_entry ke
            JOIN entity s ON s.id = ke.entity_id AND s.archived_at IS NULL
            JOIN knowledge_section sec ON sec.id = ke.section_id
            WHERE ke.archived_at IS NULL AND ke.section_id NOT IN ({', '.join('?' * len(SKIP_SECTIONS))}) {where}
            ORDER BY random() LIMIT ?""", [*SKIP_SECTIONS, *params, limit]):
        cards.append({
            "id": f"entry:{e['id']}", "kind": "entry",
            "entity_id": e["entity_id"], "entity_name": e["entity_name"],
            "prompt": e["section_label"] + (f": {e['title']}" if e["title"] else ""),
            "answer": e["body"], "status_code": e["status_code"],
        })
    random.shuffle(cards)
    return cards[:limit]
