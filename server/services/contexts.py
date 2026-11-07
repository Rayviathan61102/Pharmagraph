"""Conditions on a claim ("only in adults", "per Thai FDA 2024"), for entries and relationships alike."""
from ..util import new_id, now
from . import history
from .errors import Invalid
from .history import rows

OWNER_COLUMN = {"knowledge_entry": "knowledge_entry_id", "relationship": "relationship_id"}


def contexts_for(conn, table: str, ids: list[str]) -> dict[str, list[dict]]:
    """Conditions of many entries or relationships at once: {id: [condition, ...]}."""
    column = OWNER_COLUMN[table]
    result: dict[str, list[dict]] = {i: [] for i in ids}
    if not ids:
        return result
    marks = ", ".join("?" * len(ids))
    for c in rows(conn, f"""
            SELECT c.*, k.label AS kind_label, e.name AS value_entity_name FROM claim_context c
            JOIN context_kind k ON k.id = c.context_kind_id
            LEFT JOIN entity e ON e.id = c.value_entity_id
            WHERE c.{column} IN ({marks}) ORDER BY c.created_at""", ids):
        result[c[column]].append(c)
    return result


def insert(conn, table: str, owner_id: str, context_kind_id: str, value_text: str | None = None,
           value_entity_id: str | None = None) -> str:
    """Add a condition row without recording history (the caller does). Returns a short description."""
    conn.execute(f"""
        INSERT INTO claim_context (id, {OWNER_COLUMN[table]}, context_kind_id, value_text, value_entity_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)""", (new_id(), owner_id, context_kind_id, value_text, value_entity_id, now()))
    return f"{context_kind_id} = {value_text or value_entity_id}"


def add(conn, table: str, owner_id: str, **context) -> None:
    history.require_active(history.get_row(conn, table, owner_id), table)
    described = insert(conn, table, owner_id, **context)
    history.bump(conn, table, owner_id, "update", f"Added condition: {described}")


def replace(conn, table: str, owner_id: str, kinds: list[str], new: list[dict], reason: str | None = None) -> None:
    """Swap all conditions of the given kinds for `new` as ONE change (one new version, not one per row).
    Used when editing e.g. a metabolite's activity, enzyme, pathway and share together."""
    if not kinds:
        raise Invalid("Say which kinds of condition are being replaced.")
    stray = {c["context_kind_id"] for c in new} - set(kinds)
    if stray:
        raise Invalid(f"Conditions of kind {', '.join(sorted(stray))} are not part of this change.")
    history.require_active(history.get_row(conn, table, owner_id), table)
    marks = ", ".join("?" * len(kinds))
    conn.execute(f"DELETE FROM claim_context WHERE {OWNER_COLUMN[table]} = ? AND context_kind_id IN ({marks})",
                 (owner_id, *kinds))
    for c in new:
        insert(conn, table, owner_id, **c)
    history.bump(conn, table, owner_id, "update", reason or "Updated conditions")


def remove(conn, table: str, owner_id: str, context_id: str) -> None:
    """Conditions can be removed: the previous revision's snapshot still holds them."""
    history.require_active(history.get_row(conn, table, owner_id), table)
    row = conn.execute(f"SELECT * FROM claim_context WHERE id = ? AND {OWNER_COLUMN[table]} = ?",
                       (context_id, owner_id)).fetchone()
    if row is None:
        raise Invalid("No such condition here.")
    conn.execute("DELETE FROM claim_context WHERE id = ?", (context_id,))
    history.bump(conn, table, owner_id, "update",
                 f"Removed condition: {row['context_kind_id']} = {row['value_text'] or row['value_entity_id']}")
