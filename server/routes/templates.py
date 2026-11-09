"""HTTP API for entity templates, their topics, and entity images."""
from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from ..db.connection import transaction
from ..services import history, templates
from .common import Conn, Text

router = APIRouter(prefix="/api", tags=["templates"])


class SectionIn(BaseModel):
    label: Text


class TemplateIn(BaseModel):
    label: Text
    sections: list[str] = []


class TemplateUpdate(BaseModel):
    label: Text | None = None
    sections: list[str] | None = None


@router.post("/sections", status_code=201)
def create_section(body: SectionIn, conn: Conn):
    with transaction(conn):
        return templates.create_section(conn, body.label)


@router.post("/templates", status_code=201)
def create_template(body: TemplateIn, conn: Conn):
    with transaction(conn):
        return templates.create_template(conn, body.label, body.sections)


@router.patch("/templates/{type_id}")
def update_template(type_id: str, body: TemplateUpdate, conn: Conn):
    with transaction(conn):
        return templates.update_template(conn, type_id, body.label, body.sections)


@router.post("/templates/{type_id}/archive")
def archive_template(type_id: str, conn: Conn):
    with transaction(conn):
        templates.archive_template(conn, type_id)
    return {"ok": True}


@router.get("/entities/{entity_id}/images")
def list_images(entity_id: str, conn: Conn):
    return templates.list_images(conn, entity_id)


@router.post("/entities/{entity_id}/images", status_code=201)
async def add_image(entity_id: str, request: Request, conn: Conn):
    data = await request.body()  # the raw file; its type is checked from its bytes, not from the request
    with transaction(conn):
        return templates.add_image(conn, entity_id, data)


@router.get("/images/{image_id}")
def get_image(image_id: str, conn: Conn):
    image = history.get_row(conn, "entity_image", image_id)
    return Response(image["data"], media_type=image["media_type"], headers={"X-Content-Type-Options": "nosniff"})


@router.post("/images/{image_id}/archive")
def archive_image(image_id: str, conn: Conn):
    with transaction(conn):
        templates.archive_image(conn, image_id)
    return {"ok": True}
