"""Personal notes (spec 13): a scratchpad and inbox. A note is attached to at most one thing (entity,
knowledge entry, relationship or source) or to nothing (the inbox). Notes never change the scientific
entries they are attached to: they are separate rows, and attaching one does not touch the target."""
from ..util import new_id, now
from . import history
from .errors import Invalid
from .history import rows

TARGETS = {"entity_id": "entity", "knowledge_entry_id": "knowledge_entry",
           "relationship_id": "relationship", "source_id": "source"}

NOTE_SELECT = """
    SELECT n.*,
           coalesce(n.entity_id, ke.entity_id) AS about_entity_id,
           coalesce(e.name, ke_entity.name) AS about_entity_name,
           s.label AS section_label, ke.scope AS entry_scope, src.title AS source_title
    FROM user_note n
    LEFT JOIN entity e ON e.id = n.entity_id
    LEFT JOIN knowledge_entry ke ON ke.id = n.knowledge_entry_id
    LEFT JOIN entity ke_entity ON ke_entity.id = ke.entity_id
    LEFT JOIN knowledge_section s ON s.id = ke.section_id
    LEFT JOIN source src ON src.id = n.source_id"""


def _check_targets(conn, targets: dict) -> dict:
    chosen = {k: v for k, v in targets.items() if v}
    if len(chosen) > 1:
        raise Invalid("A note can be attached to one thing at most.")
    for column, value in chosen.items():
        history.get_row(conn, TARGETS[column], value)  # 404 if it does not exist
    return chosen


def get_note(conn, note_id: str) -> dict:
    history.get_row(conn, "user_note", note_id)
    return rows(conn, f"{NOTE_SELECT} WHERE n.id = ?", (note_id,))[0]


def create_note(conn, *, body: str, stage: str | None = None, **targets) -> dict:
    chosen = _check_targets(conn, targets)
    note_id, t = new_id(), now()
    conn.execute("""
        INSERT INTO user_note (id, body, entity_id, knowledge_entry_id, relationship_id, source_id, stage,
                               created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                 (note_id, body, *(chosen.get(c) for c in TARGETS), stage or ("connected" if chosen else "inbox"), t, t))
    return get_note(conn, note_id)


def update_note(conn, note_id: str, changes: dict) -> dict:
    """Edit text or stage, or re-attach (sending any target field replaces the attachment)."""
    note = history.get_row(conn, "user_note", note_id)
    if note["archived_at"]:
        raise Invalid("This note is archived. Restore it first.")
    fields = {k: v for k, v in changes.items() if k in ("body", "stage")}
    if set(changes) & set(TARGETS):
        chosen = _check_targets(conn, {k: changes.get(k) for k in TARGETS})
        fields.update({column: chosen.get(column) for column in TARGETS})
    if fields:
        assignments = ", ".join(f"{column} = ?" for column in fields)
        conn.execute(f"UPDATE user_note SET {assignments}, updated_at = ? WHERE id = ?", (*fields.values(), now(), note_id))
    return get_note(conn, note_id)


def set_archived(conn, note_id: str, archived: bool) -> dict:
    history.get_row(conn, "user_note", note_id)
    conn.execute("UPDATE user_note SET archived_at = ?, updated_at = ? WHERE id = ?",
                 (now() if archived else None, now(), note_id))
    return get_note(conn, note_id)


def list_notes(conn, *, inbox: bool = False, entity_id: str | None = None, include_archived: bool = False) -> list[dict]:
    where, params = ["(? OR n.archived_at IS NULL)"], [include_archived]
    if inbox:
        where.append("n.entity_id IS NULL AND n.knowledge_entry_id IS NULL AND n.relationship_id IS NULL "
                     "AND n.source_id IS NULL")
    if entity_id:
        history.get_row(conn, "entity", entity_id)
        # notes on the entity itself, on its knowledge entries, or on relationships touching it
        where.append("""(n.entity_id = ? OR ke.entity_id = ? OR n.relationship_id IN (
                           SELECT id FROM relationship WHERE source_entity_id = ? OR target_entity_id = ?))""")
        params += [entity_id] * 4
    return rows(conn, f"{NOTE_SELECT} WHERE {' AND '.join(where)} ORDER BY n.updated_at DESC", params)


def inbox_count(conn) -> int:
    return conn.execute("""SELECT COUNT(*) FROM user_note WHERE archived_at IS NULL AND entity_id IS NULL
                           AND knowledge_entry_id IS NULL AND relationship_id IS NULL AND source_id IS NULL""").fetchone()[0]
