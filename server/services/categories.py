"""The navigation tree (spec 7.2). Categories organise the sidebar only; they never copy entities,
and one entity can sit in several categories. Category changes are not knowledge, so no revisions."""
from ..util import new_id, now
from . import history
from .errors import Invalid
from .history import rows


def _require_category(conn, category_id: str) -> dict:
    category = history.get_row(conn, "category", category_id)
    if category["archived_at"]:
        raise Invalid("This category is archived.")
    return category


def create_category(conn, *, name: str, parent_id: str | None = None, description: str | None = None) -> dict:
    if parent_id:
        _require_category(conn, parent_id)
    category_id = new_id()
    conn.execute("INSERT INTO category (id, parent_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)",
                 (category_id, parent_id, name, description, now()))
    return history.get_row(conn, "category", category_id)


def _ancestors_and_self(conn, category_id: str) -> set[str]:
    """category_id, its parent, grandparent ... up to the top."""
    return {r["id"] for r in rows(conn, """
        WITH RECURSIVE up(id, parent_id) AS (
          SELECT id, parent_id FROM category WHERE id = ?
          UNION ALL
          SELECT c.id, c.parent_id FROM category c JOIN up ON c.id = up.parent_id
        )
        SELECT id FROM up""", (category_id,))}


def update_category(conn, category_id: str, changes: dict) -> dict:
    """Rename, describe, reorder or move (change parent_id; None = top level)."""
    unknown = set(changes) - {"name", "description", "parent_id", "sort_order"}
    if unknown:
        raise Invalid(f"These fields cannot be edited: {', '.join(sorted(unknown))}")
    _require_category(conn, category_id)
    new_parent = changes.get("parent_id")
    if new_parent:
        _require_category(conn, new_parent)
        if category_id in _ancestors_and_self(conn, new_parent):
            raise Invalid("A category cannot be moved inside itself or one of its own subcategories.")
    if changes:
        assignments = ", ".join(f"{column} = ?" for column in changes)
        conn.execute(f"UPDATE category SET {assignments} WHERE id = ?", (*changes.values(), category_id))
    return history.get_row(conn, "category", category_id)


def set_archived(conn, category_id: str, archived: bool) -> dict:
    history.get_row(conn, "category", category_id)
    conn.execute("UPDATE category SET archived_at = ? WHERE id = ?", (now() if archived else None, category_id))
    return history.get_row(conn, "category", category_id)


def children(conn, parent_id: str | None = None) -> dict:
    """One level of the tree: subcategories (with counts, so the sidebar knows what can expand) and entities."""
    subcategories = rows(conn, """
        SELECT c.id, c.name, c.description, c.parent_id,
               (SELECT COUNT(*) FROM category s WHERE s.parent_id = c.id AND s.archived_at IS NULL) AS child_count,
               (SELECT COUNT(*) FROM entity_category ec JOIN entity e ON e.id = ec.entity_id
                WHERE ec.category_id = c.id AND e.archived_at IS NULL) AS entity_count
        FROM category c
        WHERE c.parent_id IS ? AND c.archived_at IS NULL
        ORDER BY c.sort_order, c.name COLLATE NOCASE""", (parent_id,))
    entities = [] if parent_id is None else rows(conn, """
        SELECT e.id, e.name, e.entity_type_id, e.status_code FROM entity_category ec
        JOIN entity e ON e.id = ec.entity_id
        WHERE ec.category_id = ? AND e.archived_at IS NULL
        ORDER BY ec.sort_order, e.name COLLATE NOCASE""", (parent_id,))
    return {"categories": subcategories, "entities": entities}


def all_with_paths(conn) -> list[dict]:
    """Every active category with its full path, e.g. 'Pharmacology › Antimicrobials › Antivirals'."""
    found = {c["id"]: c for c in rows(conn, "SELECT id, name, parent_id FROM category WHERE archived_at IS NULL")}

    def path(c: dict) -> str:
        parts, seen = [], set()
        while c and c["id"] not in seen:  # 'seen' guards against a loop even if one ever slipped in
            seen.add(c["id"])
            parts.append(c["name"])
            c = found.get(c["parent_id"])
        return " › ".join(reversed(parts))

    return sorted(({**c, "path": path(c)} for c in found.values()), key=lambda c: c["path"].lower())


def add_entity(conn, category_id: str, entity_id: str) -> None:
    _require_category(conn, category_id)
    history.require_active(history.get_row(conn, "entity", entity_id), "entity")
    conn.execute("INSERT OR IGNORE INTO entity_category (entity_id, category_id) VALUES (?, ?)",
                 (entity_id, category_id))


def remove_entity(conn, category_id: str, entity_id: str) -> None:
    conn.execute("DELETE FROM entity_category WHERE entity_id = ? AND category_id = ?", (entity_id, category_id))


def categories_of(conn, entity_id: str) -> list[dict]:
    history.get_row(conn, "entity", entity_id)
    mine = {r["category_id"] for r in rows(conn, "SELECT category_id FROM entity_category WHERE entity_id = ?",
                                           (entity_id,))}
    return [c for c in all_with_paths(conn) if c["id"] in mine]
