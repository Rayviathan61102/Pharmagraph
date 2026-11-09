"""Reference lists the interface needs for its menus, in one request."""
from fastapi import APIRouter

from ..services.history import rows
from .common import Conn

router = APIRouter(prefix="/api", tags=["lookups"])


@router.get("/lookups")
def lookups(conn: Conn):
    return {
        "statuses": rows(conn, "SELECT * FROM verification_status ORDER BY sort_order"),
        "entity_types": rows(conn, "SELECT * FROM entity_type WHERE archived_at IS NULL ORDER BY label"),
        "relationship_types": rows(conn, "SELECT * FROM relationship_type WHERE archived_at IS NULL ORDER BY label"),
        "sections": rows(conn, "SELECT * FROM knowledge_section WHERE archived_at IS NULL ORDER BY sort_order"),
        "type_sections": rows(conn, "SELECT * FROM entity_type_section ORDER BY sort_order"),
        "context_kinds": rows(conn, "SELECT * FROM context_kind ORDER BY label"),
    }
