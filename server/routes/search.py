"""HTTP API for search."""
from fastapi import APIRouter

from ..services import search as search_service
from .common import Conn

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search")
def search(conn: Conn, q: str = "", include_archived: bool = False):
    return search_service.search(conn, q, include_archived)
