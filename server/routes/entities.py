"""HTTP API for entities and their aliases."""
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from ..db.connection import transaction
from ..services import entities
from ..services import entries as knowledge
from .common import Conn, LongText, Text

router = APIRouter(prefix="/api/entities", tags=["entities"])


class AliasIn(BaseModel):
    alias: Text
    alias_kind: str = "synonym"
    language: str | None = None
    jurisdiction: str | None = None


class TemplateEntry(BaseModel):
    section_id: str
    body: LongText


class EntityCreate(BaseModel):
    entity_type_id: str
    name: Text
    description: str | None = None
    status_code: str = "proposed"
    aliases: list[AliasIn] = []
    allow_duplicate: bool = False  # set after the user has seen the duplicate warning
    entries: list[TemplateEntry] = []  # the template boxes the user filled in (all optional)
    entries_scope: Literal["general", "lecture", "personal", "both"] = "general"


class EntityUpdate(BaseModel):
    name: Text | None = None
    description: str | None = None
    entity_type_id: str | None = None
    reason: str | None = None


@router.get("")
def list_entities(conn: Conn, q: str | None = None, include_archived: bool = False):
    return entities.list_entities(conn, q, include_archived)


@router.post("", status_code=201)
def create_entity(body: EntityCreate, conn: Conn):
    with transaction(conn):  # the entity and its filled-in boxes are saved together, or not at all
        created = entities.create_entity(
            conn, entity_type_id=body.entity_type_id, name=body.name, description=body.description,
            status_code=body.status_code, aliases=[a.model_dump() for a in body.aliases],
            allow_duplicate=body.allow_duplicate)
        for e in body.entries:
            knowledge.create_entry(conn, entity_id=created["id"], scope=body.entries_scope, section_id=e.section_id,
                                   body=e.body, status_code=body.status_code)
        return created


@router.get("/{entity_id}")
def get_entity(entity_id: str, conn: Conn):
    return entities.get_entity(conn, entity_id)


@router.patch("/{entity_id}")
def update_entity(entity_id: str, body: EntityUpdate, conn: Conn):
    changes = body.model_dump(exclude_unset=True)  # only the fields the user actually sent
    reason = changes.pop("reason", None)
    with transaction(conn):
        return entities.update_entity(conn, entity_id, changes, reason)


@router.post("/{entity_id}/aliases", status_code=201)
def add_alias(entity_id: str, body: AliasIn, conn: Conn):
    with transaction(conn):
        return entities.add_alias(conn, entity_id, **body.model_dump())


@router.post("/{entity_id}/aliases/{alias_id}/archive")
def remove_alias(entity_id: str, alias_id: str, conn: Conn):
    with transaction(conn):
        return entities.remove_alias(conn, entity_id, alias_id)
