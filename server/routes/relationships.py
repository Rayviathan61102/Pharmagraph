"""HTTP API for relationships, relationship types, and conditions on entries/relationships."""
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from ..db.connection import transaction
from ..services import contexts, relationships
from .common import Conn, Text

router = APIRouter(prefix="/api", tags=["relationships"])


class ContextIn(BaseModel):
    context_kind_id: str
    value_text: str | None = None
    value_entity_id: str | None = None


class RelationshipCreate(BaseModel):
    source_entity_id: str
    target_entity_id: str
    relationship_type_id: str
    description: str | None = None
    scope: Literal["general", "lecture", "personal"] = "general"
    lecture_id: str | None = None
    status_code: str = "proposed"
    contexts: list[ContextIn] = []


class RelationshipUpdate(BaseModel):
    relationship_type_id: str | None = None
    description: str | None = None
    lecture_id: str | None = None
    reason: str | None = None


class RelationshipTypeIn(BaseModel):
    label: Text
    inverse_label: str | None = None
    description: str | None = None
    is_directed: bool = True


@router.post("/relationship-types", status_code=201)
def create_relationship_type(body: RelationshipTypeIn, conn: Conn):
    with transaction(conn):
        return relationships.create_relationship_type(conn, **body.model_dump())


@router.post("/relationships", status_code=201)
def create_relationship(body: RelationshipCreate, conn: Conn):
    data = body.model_dump()
    data["contexts_in"] = data.pop("contexts")
    with transaction(conn):
        return relationships.create_relationship(conn, **data)


@router.get("/relationships/{relationship_id}")
def get_relationship(relationship_id: str, conn: Conn):
    return relationships.get_relationship(conn, relationship_id)


@router.patch("/relationships/{relationship_id}")
def update_relationship(relationship_id: str, body: RelationshipUpdate, conn: Conn):
    changes = body.model_dump(exclude_unset=True)
    reason = changes.pop("reason", None)
    with transaction(conn):
        return relationships.update_relationship(conn, relationship_id, changes, reason)


@router.get("/entities/{entity_id}/relationships")
def list_relationships(entity_id: str, conn: Conn, include_archived: bool = False):
    return relationships.list_for_entity(conn, entity_id, include_archived)


# Conditions work the same way on knowledge entries and on relationships.
Owner = Literal["entries", "relationships"]
OWNER_TABLE = {"entries": "knowledge_entry", "relationships": "relationship"}


@router.post("/{owner}/{owner_id}/contexts", status_code=201)
def add_context(owner: Owner, owner_id: str, body: ContextIn, conn: Conn):
    with transaction(conn):
        contexts.add(conn, OWNER_TABLE[owner], owner_id, **body.model_dump())
    return {"ok": True}


class ContextsReplace(BaseModel):
    kinds: list[str]           # every condition of these kinds is replaced ...
    contexts: list[ContextIn]  # ... by these
    reason: str | None = None


@router.put("/{owner}/{owner_id}/contexts")
def replace_contexts(owner: Owner, owner_id: str, body: ContextsReplace, conn: Conn):
    with transaction(conn):
        contexts.replace(conn, OWNER_TABLE[owner], owner_id, body.kinds,
                         [c.model_dump() for c in body.contexts], body.reason)
    return {"ok": True}


@router.post("/{owner}/{owner_id}/contexts/{context_id}/remove")
def remove_context(owner: Owner, owner_id: str, context_id: str, conn: Conn):
    with transaction(conn):
        contexts.remove(conn, OWNER_TABLE[owner], owner_id, context_id)
    return {"ok": True}
