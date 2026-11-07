"""HTTP API for personal notes."""
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from ..db.connection import transaction
from ..services import notes
from .common import Conn, LongText

router = APIRouter(prefix="/api", tags=["notes"])

Stage = Literal["inbox", "draft", "connected", "reviewed", "verified"]


class NoteIn(BaseModel):
    body: LongText
    stage: Stage | None = None
    entity_id: str | None = None
    knowledge_entry_id: str | None = None
    relationship_id: str | None = None
    source_id: str | None = None


class NoteUpdate(BaseModel):
    body: LongText | None = None
    stage: Stage | None = None
    entity_id: str | None = None
    knowledge_entry_id: str | None = None
    relationship_id: str | None = None
    source_id: str | None = None


@router.get("/notes")
def list_notes(conn: Conn, inbox: bool = False, entity_id: str | None = None, include_archived: bool = False):
    return notes.list_notes(conn, inbox=inbox, entity_id=entity_id, include_archived=include_archived)


@router.get("/notes/inbox-count")
def inbox_count(conn: Conn):
    return {"count": notes.inbox_count(conn)}


@router.post("/notes", status_code=201)
def create_note(body: NoteIn, conn: Conn):
    with transaction(conn):
        return notes.create_note(conn, **body.model_dump())


@router.patch("/notes/{note_id}")
def update_note(note_id: str, body: NoteUpdate, conn: Conn):
    with transaction(conn):
        return notes.update_note(conn, note_id, body.model_dump(exclude_unset=True))


@router.post("/notes/{note_id}/archive")
def archive_note(note_id: str, conn: Conn):
    with transaction(conn):
        return notes.set_archived(conn, note_id, True)


@router.post("/notes/{note_id}/unarchive")
def unarchive_note(note_id: str, conn: Conn):
    with transaction(conn):
        return notes.set_archived(conn, note_id, False)
