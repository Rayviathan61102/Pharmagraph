"""HTTP API for the graph panel. POST is used because the list of nodes on screen can be long."""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..services import graph
from .common import Conn

router = APIRouter(prefix="/api/graph", tags=["graph"])

MAX_ON_SCREEN = 500  # the interface warns well before this; the server refuses beyond it


class Filters(BaseModel):
    types: list[str] | None = None   # relationship type ids to show (None = all)
    scopes: list[str] | None = None  # general / lecture / personal (None = all)


class ExpandIn(Filters):
    entity_id: str
    exclude: list[str] = Field(default=[], max_length=MAX_ON_SCREEN)
    limit: int = Field(default=graph.DEFAULT_LIMIT, ge=1, le=100)


class ViewIn(Filters):
    ids: list[str] = Field(max_length=MAX_ON_SCREEN)


@router.get("/node/{entity_id}")
def node(entity_id: str, conn: Conn):
    return graph.node(conn, entity_id)


@router.post("/expand")
def expand(body: ExpandIn, conn: Conn):
    return graph.expand(conn, body.entity_id, body.exclude, body.limit, body.types, body.scopes)


@router.post("/view")
def view(body: ViewIn, conn: Conn):
    return graph.view(conn, body.ids, body.types, body.scopes)
