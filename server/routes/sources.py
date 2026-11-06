"""HTTP API for sources and evidence links."""
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from ..db.connection import transaction
from ..services import history, sources
from .common import Conn, Text

router = APIRouter(prefix="/api", tags=["sources and evidence"])

SourceType = Literal["lecture_slides", "lecture_document", "textbook", "research_paper", "clinical_guideline",
                     "drug_monograph", "regulatory_document", "website", "other"]


class SourceIn(BaseModel):
    source_type: SourceType
    title: Text
    authors: str | None = None
    organization: str | None = None
    publication_date: str | None = None
    edition: str | None = None
    version_label: str | None = None
    doi: str | None = None
    url: str | None = None
    isbn: str | None = None
    jurisdiction: str | None = None
    language: str | None = None
    lecture_id: str | None = None
    supersedes_source_id: str | None = None
    notes: str | None = None


class SourceUpdate(SourceIn):
    source_type: SourceType | None = None
    title: Text | None = None


class EvidenceIn(BaseModel):
    source_id: str
    knowledge_entry_id: str | None = None
    relationship_id: str | None = None
    stance: Literal["supports", "contradicts", "mentions"] = "supports"
    evidence_type: str = "other"
    claim_text: str | None = None
    locator: str | None = None
    passage: str | None = None
    verification_notes: str | None = None


@router.get("/sources")
def list_sources(conn: Conn, q: str | None = None, include_archived: bool = False):
    return sources.list_sources(conn, q, include_archived)


@router.post("/sources", status_code=201)
def create_source(body: SourceIn, conn: Conn):
    with transaction(conn):
        return sources.create_source(conn, **body.model_dump())


@router.get("/sources/{source_id}")
def get_source(source_id: str, conn: Conn):
    return history.get_row(conn, "source", source_id)


@router.patch("/sources/{source_id}")
def update_source(source_id: str, body: SourceUpdate, conn: Conn):
    with transaction(conn):
        return sources.update_source(conn, source_id, body.model_dump(exclude_unset=True))


@router.post("/sources/{source_id}/archive")
def archive_source(source_id: str, conn: Conn):
    with transaction(conn):
        return sources.archive_source(conn, source_id)


@router.post("/evidence", status_code=201)
def create_evidence(body: EvidenceIn, conn: Conn):
    with transaction(conn):
        return sources.create_evidence(conn, **body.model_dump())


@router.post("/evidence/{evidence_id}/archive")
def archive_evidence(evidence_id: str, conn: Conn):
    with transaction(conn):
        return sources.archive_evidence(conn, evidence_id)
