"""HTTP API for chemical structures and their highlighted features."""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..db.connection import transaction
from ..services import structures
from .common import Conn, LongText, Text
from .history import ReasonIn

router = APIRouter(prefix="/api", tags=["structures"])

Color = Field(default="#e0b050", pattern=r"^#[0-9a-fA-F]{6}$")


class StructureIn(BaseModel):
    original_smiles: Text
    label: str | None = None
    canonical_smiles: str | None = None
    canonicalizer: str | None = None
    molecular_formula: str | None = None
    molecular_weight: float | None = None


class AnnotationIn(BaseModel):
    atom_indices: list[int] = Field(min_length=1)
    note: LongText
    color: str = Color
    status_code: str = "proposed"


class AnnotationUpdate(BaseModel):
    atom_indices: list[int] | None = Field(default=None, min_length=1)
    note: LongText | None = None
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    status_code: str | None = None


@router.get("/entities/{entity_id}/structures")
def list_structures(entity_id: str, conn: Conn):
    return structures.list_structures(conn, entity_id)


@router.post("/entities/{entity_id}/structures", status_code=201)
def create_structure(entity_id: str, body: StructureIn, conn: Conn):
    with transaction(conn):
        return structures.create_structure(conn, entity_id, **body.model_dump())


@router.get("/structures/{structure_id}")
def get_structure(structure_id: str, conn: Conn):
    return structures.get_structure(conn, structure_id)


@router.post("/structures/{structure_id}/archive")
def archive_structure(structure_id: str, body: ReasonIn, conn: Conn):
    with transaction(conn):
        structures.archive_structure(conn, structure_id, body.reason)
    return {"ok": True}


@router.post("/structures/{structure_id}/annotations", status_code=201)
def create_annotation(structure_id: str, body: AnnotationIn, conn: Conn):
    with transaction(conn):
        return structures.create_annotation(conn, structure_id, **body.model_dump())


@router.patch("/annotations/{annotation_id}")
def update_annotation(annotation_id: str, body: AnnotationUpdate, conn: Conn):
    with transaction(conn):
        return structures.update_annotation(conn, annotation_id, body.model_dump(exclude_unset=True))


@router.post("/annotations/{annotation_id}/archive")
def archive_annotation(annotation_id: str, body: ReasonIn, conn: Conn):
    with transaction(conn):
        structures.archive_annotation(conn, annotation_id, body.reason)
    return {"ok": True}


@router.get("/annotations/{annotation_id}/history")
def annotation_history(annotation_id: str, conn: Conn):
    return structures.annotation_history(conn, annotation_id)
