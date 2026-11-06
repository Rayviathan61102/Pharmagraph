"""Revision history: the ONLY way entities, knowledge entries and relationships are changed.

Every change saves a full snapshot (the row plus its aliases or conditions) as a new revision,
in the same transaction as the change itself, so no edit can ever lose the previous version.
"""
import json

from ..util import new_id, now
from .errors import Invalid, NotFound

# Versioned table -> the column in `revision` that points to it.
# Table and column names below always come from this dict, never from user input.
REVISION_COLUMN = {
    "entity": "entity_id",
    "knowledge_entry": "knowledge_entry_id",
    "relationship": "relationship_id",
}

LABEL = {"entity": "entity", "knowledge_entry": "knowledge entry", "relationship": "relationship"}


def rows(conn, sql, params=()) -> list[dict]:
    return [dict(r) for r in conn.execute(sql, params)]


def get_row(conn, table: str, row_id: str) -> dict:
    row = conn.execute(f"SELECT * FROM {table} WHERE id = ?", (row_id,)).fetchone()
    if row is None:
        raise NotFound(f"No {LABEL.get(table, table)} with id {row_id}")
    return dict(row)


def snapshot(conn, table: str, row_id: str) -> dict:
    data = get_row(conn, table, row_id)
    if table == "entity":
        data["aliases"] = rows(conn, "SELECT * FROM entity_alias WHERE entity_id = ? ORDER BY alias", (row_id,))
    else:
        column = REVISION_COLUMN[table]
        data["contexts"] = rows(
            conn, f"SELECT * FROM claim_context WHERE {column} = ? ORDER BY created_at", (row_id,))
    return data


def record(conn, table: str, row_id: str, change_kind: str, reason: str | None = None,
           changed_by: str = "user") -> None:
    """Save the row's current state as a revision. Used directly only for 'create'."""
    snap = snapshot(conn, table, row_id)
    conn.execute(
        f"INSERT INTO revision (id, {REVISION_COLUMN[table]}, version, change_kind, snapshot_json, "
        "changed_by, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (new_id(), row_id, snap["version"], change_kind, json.dumps(snap, ensure_ascii=False),
         changed_by, reason, now()))


def bump(conn, table: str, row_id: str, change_kind: str, reason: str | None = None,
         changed_by: str = "user") -> None:
    """The row (or something belonging to it) changed: increase its version and save a revision."""
    conn.execute(f"UPDATE {table} SET version = version + 1, updated_at = ? WHERE id = ?", (now(), row_id))
    record(conn, table, row_id, change_kind, reason, changed_by)


def require_active(row: dict, table: str) -> None:
    if row["archived_at"]:
        raise Invalid(f"This {LABEL[table]} is archived. Restore it before changing it.")


def update_fields(conn, table: str, row_id: str, changes: dict, reason: str | None = None) -> bool:
    """Change some columns and save a revision. Returns False when nothing actually changed.

    `changes` keys must be column names chosen by the calling service, never raw user input.
    """
    row = get_row(conn, table, row_id)
    require_active(row, table)
    changes = {column: value for column, value in changes.items() if row[column] != value}
    if not changes:
        return False  # identical values: no new version
    assignments = ", ".join(f"{column} = ?" for column in changes)
    conn.execute(f"UPDATE {table} SET {assignments} WHERE id = ?", (*changes.values(), row_id))
    bump(conn, table, row_id, "update", reason)
    return True


def archive(conn, table: str, row_id: str, reason: str | None = None) -> None:
    row = get_row(conn, table, row_id)
    if row["archived_at"]:
        raise Invalid(f"This {LABEL[table]} is already archived.")
    conn.execute(f"UPDATE {table} SET archived_at = ?, archive_reason = ? WHERE id = ?", (now(), reason, row_id))
    bump(conn, table, row_id, "archive", reason)


def unarchive(conn, table: str, row_id: str, reason: str | None = None) -> None:
    row = get_row(conn, table, row_id)
    if not row["archived_at"]:
        raise Invalid(f"This {LABEL[table]} is not archived.")
    conn.execute(f"UPDATE {table} SET archived_at = NULL, archive_reason = NULL WHERE id = ?", (row_id,))
    bump(conn, table, row_id, "unarchive", reason)


def revisions(conn, table: str, row_id: str) -> list[dict]:
    """All versions, newest first."""
    get_row(conn, table, row_id)  # 404 if it does not exist
    result = rows(conn, f"SELECT * FROM revision WHERE {REVISION_COLUMN[table]} = ? ORDER BY version DESC",
                  (row_id,))
    for r in result:
        r["snapshot"] = json.loads(r.pop("snapshot_json"))
    return result
