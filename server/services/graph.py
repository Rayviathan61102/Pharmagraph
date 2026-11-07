"""Graph queries (analysis 5.2): neighbourhoods on demand, never the whole database.

Uses the `active_edge` view, which lists every non-archived relationship in both directions,
so "neighbours of X" is a single indexed lookup whichever end X is on.
"""
from . import history
from .history import rows

DEFAULT_LIMIT = 25


def _filters(types: list[str] | None, scopes: list[str] | None, params: list) -> str:
    """Optional relationship filters as extra SQL conditions (values go in params, never into the SQL)."""
    sql = ""
    if types:
        sql += f" AND e.relationship_type_id IN ({', '.join('?' * len(types))})"
        params.extend(types)
    if scopes:
        sql += f" AND e.scope IN ({', '.join('?' * len(scopes))})"
        params.extend(scopes)
    return sql


def node(conn, entity_id: str) -> dict:
    entity = history.get_row(conn, "entity", entity_id)
    return {k: entity[k] for k in ("id", "name", "entity_type_id", "status_code", "archived_at")}


def expand(conn, entity_id: str, exclude: list[str], limit: int = DEFAULT_LIMIT,
           types: list[str] | None = None, scopes: list[str] | None = None) -> dict:
    """Up to `limit` neighbours of one entity that are not already on screen, plus how many remain."""
    history.get_row(conn, "entity", entity_id)
    params: list = [entity_id]
    where = _filters(types, scopes, params)
    shown = set(exclude) | {entity_id}
    found = rows(conn, f"""
        SELECT n.id, n.name, n.entity_type_id, n.status_code,
               MAX(e.status_code = 'verified') AS has_verified_link
        FROM active_edge e JOIN entity n ON n.id = e.to_id AND n.archived_at IS NULL
        WHERE e.from_id = ? {where}
        GROUP BY n.id
        ORDER BY has_verified_link DESC, n.name COLLATE NOCASE""", params)
    new = [n for n in found if n["id"] not in shown]
    return {"neighbors": new[:limit], "remaining": max(0, len(new) - limit)}


def view(conn, ids: list[str], types: list[str] | None = None, scopes: list[str] | None = None) -> dict:
    """For the nodes on screen: the relationships among them, and how many hidden neighbours each has."""
    if not ids:
        return {"edges": [], "hidden": {}}
    marks = ", ".join("?" * len(ids))
    params: list = [*ids, *ids]
    where = _filters(types, scopes, params)
    edges = rows(conn, f"""
        SELECT e.id, e.source_entity_id AS source, e.target_entity_id AS target, e.relationship_type_id,
               t.label, t.is_directed, e.scope, e.status_code
        FROM relationship e JOIN relationship_type t ON t.id = e.relationship_type_id
        WHERE e.archived_at IS NULL
          AND e.source_entity_id IN ({marks}) AND e.target_entity_id IN ({marks}) {where}""", params)
    params = [*ids, *ids]
    where = _filters(types, scopes, params)
    hidden = {r["from_id"]: r["n"] for r in rows(conn, f"""
        SELECT e.from_id, COUNT(DISTINCT e.to_id) AS n
        FROM active_edge e JOIN entity o ON o.id = e.to_id AND o.archived_at IS NULL
        WHERE e.from_id IN ({marks}) AND e.to_id NOT IN ({marks}) {where}
        GROUP BY e.from_id""", params)}
    return {"edges": edges, "hidden": hidden}
