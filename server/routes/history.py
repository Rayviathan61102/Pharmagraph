"""Archive, restore and revision history: the same for entities, entries and relationships."""
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from ..db.connection import transaction
from ..services import history
from .common import Conn

router = APIRouter(prefix="/api", tags=["history"])

Kind = Literal["entities", "entries", "relationships"]
TABLE = {"entities": "entity", "entries": "knowledge_entry", "relationships": "relationship"}


class ReasonIn(BaseModel):
    reason: str | None = None


@router.post("/{kind}/{item_id}/archive")
def archive(kind: Kind, item_id: str, body: ReasonIn, conn: Conn):
    with transaction(conn):
        history.archive(conn, TABLE[kind], item_id, body.reason)
    return history.get_row(conn, TABLE[kind], item_id)


@router.post("/{kind}/{item_id}/unarchive")
def unarchive(kind: Kind, item_id: str, body: ReasonIn, conn: Conn):
    with transaction(conn):
        history.unarchive(conn, TABLE[kind], item_id, body.reason)
    return history.get_row(conn, TABLE[kind], item_id)


@router.get("/{kind}/{item_id}/revisions")
def revisions(kind: Kind, item_id: str, conn: Conn):
    return history.revisions(conn, TABLE[kind], item_id)
