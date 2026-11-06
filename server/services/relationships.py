"""Typed relationships between entities, and custom relationship types."""
import re

from ..util import new_id, now
from . import contexts, history
from .entries import AI_ALLOWED_STATUSES
from .errors import Invalid
from .history import rows


# ---------- Relationship types ----------

def create_relationship_type(conn, *, label: str, inverse_label: str | None = None, description: str | None = None,
                             is_directed: bool = True) -> dict:
    type_id = re.sub(r"[^A-Z0-9]+", "_", label.upper()).strip("_")
    if not type_id:
        raise Invalid("The label needs at least one letter or digit.")
    if conn.execute("SELECT 1 FROM relationship_type WHERE id = ?", (type_id,)).fetchone():
        raise Invalid(f"A relationship type {type_id} already exists.")
    conn.execute("""INSERT INTO relationship_type (id, label, inverse_label, description, is_directed)
                    VALUES (?, ?, ?, ?, ?)""",
                 (type_id, label, inverse_label if is_directed else label, description, int(is_directed)))
    return dict(conn.execute("SELECT * FROM relationship_type WHERE id = ?", (type_id,)).fetchone())


# ---------- Relationships ----------

def _require_entity(conn, entity_id: str) -> None:
    history.require_active(history.get_row(conn, "entity", entity_id), "entity")


def get_relationship(conn, relationship_id: str) -> dict:
    rel = history.get_row(conn, "relationship", relationship_id)
    rel["contexts"] = contexts.contexts_for(conn, "relationship", [relationship_id])[relationship_id]
    return rel


def create_relationship(conn, *, source_entity_id: str, target_entity_id: str, relationship_type_id: str,
                        description: str | None = None, scope: str = "general", lecture_id: str | None = None,
                        status_code: str = "proposed", origin: str = "user", contexts_in: list[dict] = ()) -> dict:
    _require_entity(conn, source_entity_id)
    _require_entity(conn, target_entity_id)
    if origin == "ai" and status_code not in AI_ALLOWED_STATUSES:
        raise Invalid("AI-generated information must start as Proposed or Needs review.")
    if lecture_id and scope != "lecture":
        raise Invalid("Only lecture-specific relationships can be linked to a lecture.")
    relationship_id, t = new_id(), now()
    conn.execute("""
        INSERT INTO relationship (id, source_entity_id, target_entity_id, relationship_type_id, description, scope,
                                  lecture_id, status_code, origin, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                 (relationship_id, source_entity_id, target_entity_id, relationship_type_id, description, scope,
                  lecture_id, status_code, origin, t, t))
    for c in contexts_in:
        contexts.insert(conn, "relationship", relationship_id, **c)
    history.record(conn, "relationship", relationship_id, "create", changed_by=origin)
    return get_relationship(conn, relationship_id)


EDITABLE = {"relationship_type_id", "description", "lecture_id"}  # endpoints are fixed: archive and re-create


def update_relationship(conn, relationship_id: str, changes: dict, reason: str | None = None) -> dict:
    unknown = set(changes) - EDITABLE
    if unknown:
        raise Invalid(f"These fields cannot be edited here: {', '.join(sorted(unknown))}")
    rel = history.get_row(conn, "relationship", relationship_id)
    if changes.get("lecture_id") and rel["scope"] != "lecture":
        raise Invalid("Only lecture-specific relationships can be linked to a lecture.")
    history.update_fields(conn, "relationship", relationship_id, changes, reason)
    return get_relationship(conn, relationship_id)


def list_for_entity(conn, entity_id: str, include_archived: bool = False) -> list[dict]:
    """All relationships touching an entity, worded from its point of view ('inhibits' / 'inhibited by')."""
    history.get_row(conn, "entity", entity_id)
    result = rows(conn, """
        SELECT r.*, x.direction, o.id AS other_id, o.name AS other_name, o.entity_type_id AS other_type_id,
               o.archived_at IS NOT NULL AS other_archived,
               CASE x.direction WHEN 'out' THEN t.label ELSE t.inverse_label END AS label,
               l.title AS lecture_title
        FROM (SELECT id, 'out' AS direction, target_entity_id AS other FROM relationship WHERE source_entity_id = ?
              UNION ALL
              SELECT id, 'in', source_entity_id FROM relationship
              WHERE target_entity_id = ? AND source_entity_id <> target_entity_id) x
        JOIN relationship r ON r.id = x.id
        JOIN relationship_type t ON t.id = r.relationship_type_id
        JOIN entity o ON o.id = x.other
        LEFT JOIN lecture l ON l.id = r.lecture_id
        WHERE (? OR r.archived_at IS NULL)
        ORDER BY label, o.name COLLATE NOCASE""", (entity_id, entity_id, include_archived))
    found = contexts.contexts_for(conn, "relationship", [r["id"] for r in result])
    for r in result:
        r["contexts"] = found[r["id"]]
    return result
