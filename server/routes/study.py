"""HTTP API for the home page summary and quiz cards (read-only)."""
from typing import Annotated

from fastapi import APIRouter, Query

from ..services import study
from .common import Conn

router = APIRouter(prefix="/api", tags=["study"])


@router.get("/home")
def home(conn: Conn):
    return study.home(conn)


@router.get("/quiz")
def quiz(conn: Conn, category_id: str | None = None, limit: Annotated[int, Query(ge=1, le=50)] = 10):
    return study.quiz(conn, category_id, limit)
