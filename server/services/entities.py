"""Entities (scientific concepts) and their aliases."""
from ..util import new_id, now
from . import history
from .errors import Conflict, Invalid
from .history import rows


def find_similar(conn, names: list[str], exclude_id: str | None = None) -> list[dict]:
    """Entities whose name or alias equals one of `names` (ignoring upper/lower case)."""
    wanted = sorted({n.strip().lower() for n in names if n and n.strip()})
    if not wanted:
        return []
    marks = ", ".join("?" * len(wanted))
    return rows(conn, f"""
        SELECT DISTINCT e.id, e.name, e.entity_type_id, e.archived_at IS NOT NULL AS archived
        FROM entity e
        LEFT JOIN entity_alias a ON a.entity_id = e.id AND a.archived_at IS NULL
        WHERE (lower(e.name) IN ({marks}) OR lower(a.alias) IN ({marks})) AND e.id IS NOT ?
        ORDER BY e.name""", (*wanted, *wanted, exclude_id))


def get_entity(conn, entity_id: str) -> dict:
    entity = history.get_row(conn, "entity", entity_id)
    entity["type_label"] = conn.execute(
        "SELECT label FROM entity_type WHERE id = ?", (entity["entity_type_id"],)).fetchone()[0]
    entity["aliases"] = rows(conn, """
        SELECT id, alias, alias_kind, language, jurisdiction FROM entity_alias
        WHERE entity_id = ? AND archived_at IS NULL ORDER BY alias""", (entity_id,))
    return entity


def list_entities(conn, q: str | None = None, include_archived: bool = False, limit: int = 200) -> list[dict]:
    """Entities whose name or alias contains `q`, alphabetically."""
    q = (q or "").strip().lower()
    return rows(conn, """
        SELECT e.id, e.name, e.entity_type_id, e.status_code, e.archived_at
        FROM entity e
        WHERE (? OR e.archived_at IS NULL)
          AND (? = '' OR instr(lower(e.name), ?) > 0 OR EXISTS (
                SELECT 1 FROM entity_alias a
                WHERE a.entity_id = e.id AND a.archived_at IS NULL AND instr(lower(a.alias), ?) > 0))
        ORDER BY e.name COLLATE NOCASE
        LIMIT ?""", (include_archived, q, q, q, limit))


def _insert_alias(conn, entity_id: str, alias: str, alias_kind: str = "synonym",
                  language: str | None = None, jurisdiction: str | None = None) -> None:
    conn.execute("""
        INSERT INTO entity_alias (id, entity_id, alias, alias_kind, language, jurisdiction, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)""", (new_id(), entity_id, alias, alias_kind, language, jurisdiction, now()))


def create_entity(conn, *, entity_type_id: str, name: str, description: str | None = None,
                  status_code: str = "proposed", aliases: list[dict] = (),
                  allow_duplicate: bool = False) -> dict:
    if not allow_duplicate:
        similar = find_similar(conn, [name, *(a["alias"] for a in aliases)])
        if similar:
            raise Conflict("An entity with this name or alias may already exist.", {"possible_duplicates": similar})
    entity_id, t = new_id(), now()
    conn.execute("""
        INSERT INTO entity (id, entity_type_id, name, description, status_code, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)""", (entity_id, entity_type_id, name, description, status_code, t, t))
    for a in aliases:
        _insert_alias(conn, entity_id, **a)
    history.record(conn, "entity", entity_id, "create")
    return get_entity(conn, entity_id)


EDITABLE = {"name", "description", "entity_type_id"}  # status changes go through review (M5)


def update_entity(conn, entity_id: str, changes: dict, reason: str | None = None) -> dict:
    unknown = set(changes) - EDITABLE
    if unknown:
        raise Invalid(f"These fields cannot be edited here: {', '.join(sorted(unknown))}")
    history.update_fields(conn, "entity", entity_id, changes, reason)
    return get_entity(conn, entity_id)


def add_alias(conn, entity_id: str, alias: str, alias_kind: str = "synonym",
              language: str | None = None, jurisdiction: str | None = None) -> dict:
    history.require_active(history.get_row(conn, "entity", entity_id), "entity")
    existing = conn.execute("SELECT id, archived_at FROM entity_alias WHERE entity_id = ? AND alias = ?",
                            (entity_id, alias)).fetchone()
    if existing and not existing["archived_at"]:
        raise Invalid(f"'{alias}' is already an alias of this entity.")
    if existing:  # it was removed before: bring it back instead of duplicating it
        conn.execute("UPDATE entity_alias SET archived_at = NULL, alias_kind = ?, language = ?, jurisdiction = ? "
                     "WHERE id = ?", (alias_kind, language, jurisdiction, existing["id"]))
    else:
        _insert_alias(conn, entity_id, alias, alias_kind, language, jurisdiction)
    history.bump(conn, "entity", entity_id, "update", f"Added alias '{alias}'")
    return get_entity(conn, entity_id)


def remove_alias(conn, entity_id: str, alias_id: str) -> dict:
    history.require_active(history.get_row(conn, "entity", entity_id), "entity")
    alias = conn.execute("SELECT alias FROM entity_alias WHERE id = ? AND entity_id = ? AND archived_at IS NULL",
                         (alias_id, entity_id)).fetchone()
    if alias is None:
        raise Invalid("No such alias on this entity.")
    conn.execute("UPDATE entity_alias SET archived_at = ? WHERE id = ?", (now(), alias_id))
    history.bump(conn, "entity", entity_id, "update", f"Removed alias '{alias['alias']}'")
    return get_entity(conn, entity_id)
