"""Pieces shared by all route files."""
from typing import Annotated

from fastapi import Depends
from pydantic import StringConstraints

from ..db.connection import get_conn

Conn = Annotated[object, Depends(get_conn)]  # a database connection for this request

# Required text: surrounding spaces removed, must not be empty.
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100_000)]
