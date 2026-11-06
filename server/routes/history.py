"""Archive, restore and revision history: the same for entities, entries and relationships."""
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from ..db.connection import transaction
from ..services import history, sources
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


class StatusIn(BaseModel):
    status_code: str
    notes: str  # required: why the status changed, or what was checked


@router.post("/{kind}/{item_id}/status")
def change_status(kind: Kind, item_id: str, body: StatusIn, conn: Conn):
    with transaction(conn):
        return sources.change_status(conn, TABLE[kind], item_id, body.status_code, body.notes)


@router.get("/{kind}/{item_id}/reviews")
def reviews(kind: Kind, item_id: str, conn: Conn):
    return sources.reviews(conn, TABLE[kind], item_id)
