"""HTTP API for knowledge entries, lectures and professors."""
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from ..db.connection import transaction
from ..services import entries
from .common import Conn, LongText, Text

router = APIRouter(prefix="/api", tags=["knowledge entries"])


class ProfessorIn(BaseModel):
    name: Text
    department: str | None = None
    notes: str | None = None


class LectureIn(BaseModel):
    title: Text
    course_code: str | None = None
    course_name: str | None = None
    professor_id: str | None = None
    lecture_date: str | None = None
    academic_year: str | None = None
    notes: str | None = None


class EntryCreate(BaseModel):
    scope: Literal["general", "lecture", "personal", "both"]
    section_id: str
    body: LongText
    title: str | None = None
    lecture_id: str | None = None
    lecture_body: str | None = None  # "both" only: a different text for the lecture version
    status_code: str = "proposed"


class EntryUpdate(BaseModel):
    title: str | None = None
    body: LongText | None = None
    section_id: str | None = None
    lecture_id: str | None = None
    reason: str | None = None


@router.get("/professors")
def list_professors(conn: Conn):
    return entries.list_professors(conn)


@router.post("/professors", status_code=201)
def create_professor(body: ProfessorIn, conn: Conn):
    with transaction(conn):
        return entries.create_professor(conn, **body.model_dump())


@router.get("/lectures")
def list_lectures(conn: Conn):
    return entries.list_lectures(conn)


@router.post("/lectures", status_code=201)
def create_lecture(body: LectureIn, conn: Conn):
    with transaction(conn):
        return entries.create_lecture(conn, **body.model_dump())


@router.get("/entities/{entity_id}/entries")
def list_entries(entity_id: str, conn: Conn, include_archived: bool = False):
    return entries.list_entries(conn, entity_id, include_archived)


@router.post("/entities/{entity_id}/entries", status_code=201)
def create_entry(entity_id: str, body: EntryCreate, conn: Conn):
    with transaction(conn):
        return entries.create_entry(conn, entity_id=entity_id, **body.model_dump())


@router.get("/entries/{entry_id}")
def get_entry(entry_id: str, conn: Conn):
    return entries.get_entry(conn, entry_id)


@router.patch("/entries/{entry_id}")
def update_entry(entry_id: str, body: EntryUpdate, conn: Conn):
    changes = body.model_dump(exclude_unset=True)
    reason = changes.pop("reason", None)
    with transaction(conn):
        return entries.update_entry(conn, entry_id, changes, reason)
