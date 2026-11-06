"""HTTP API for the category tree."""
from fastapi import APIRouter
from pydantic import BaseModel

from ..db.connection import transaction
from ..services import categories
from .common import Conn, Text

router = APIRouter(prefix="/api", tags=["categories"])


class CategoryIn(BaseModel):
    name: Text
    parent_id: str | None = None
    description: str | None = None


class CategoryUpdate(BaseModel):
    name: Text | None = None
    description: str | None = None
    parent_id: str | None = None  # send null to move to the top level
    sort_order: int | None = None


class EntityRef(BaseModel):
    entity_id: str


@router.get("/categories")
def all_categories(conn: Conn):
    return categories.all_with_paths(conn)


@router.get("/categories/children")
def children(conn: Conn, parent_id: str | None = None):
    return categories.children(conn, parent_id)


@router.post("/categories", status_code=201)
def create_category(body: CategoryIn, conn: Conn):
    with transaction(conn):
        return categories.create_category(conn, **body.model_dump())


@router.patch("/categories/{category_id}")
def update_category(category_id: str, body: CategoryUpdate, conn: Conn):
    with transaction(conn):
        return categories.update_category(conn, category_id, body.model_dump(exclude_unset=True))


@router.post("/categories/{category_id}/archive")
def archive_category(category_id: str, conn: Conn):
    with transaction(conn):
        return categories.set_archived(conn, category_id, True)


@router.post("/categories/{category_id}/unarchive")
def unarchive_category(category_id: str, conn: Conn):
    with transaction(conn):
        return categories.set_archived(conn, category_id, False)


@router.post("/categories/{category_id}/entities", status_code=201)
def add_entity(category_id: str, body: EntityRef, conn: Conn):
    with transaction(conn):
        categories.add_entity(conn, category_id, body.entity_id)
    return {"ok": True}


@router.post("/categories/{category_id}/entities/{entity_id}/remove")
def remove_entity(category_id: str, entity_id: str, conn: Conn):
    with transaction(conn):
        categories.remove_entity(conn, category_id, entity_id)
    return {"ok": True}


@router.get("/entities/{entity_id}/categories")
def categories_of(entity_id: str, conn: Conn):
    return categories.categories_of(conn, entity_id)
