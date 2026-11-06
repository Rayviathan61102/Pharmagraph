"""Opening the database, and grouping changes into all-or-nothing transactions."""
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .. import config


def connect(path: Path) -> sqlite3.Connection:
    # autocommit=True: Python does no hidden transaction handling; we start them ourselves (see transaction()).
    # check_same_thread=False: the web server may hand one request's connection between worker threads.
    conn = sqlite3.connect(path, autocommit=True, check_same_thread=False)
    conn.row_factory = sqlite3.Row  # rows behave like dicts: row["name"]
    conn.execute("PRAGMA foreign_keys = ON")  # SQLite ignores foreign keys unless told, on every connection
    return conn


@contextmanager
def transaction(conn: sqlite3.Connection):
    """Everything inside `with transaction(conn):` is saved together, or (on any error) not at all."""
    if conn.in_transaction:  # already inside one: just join it
        yield
        return
    conn.execute("BEGIN")
    try:
        yield
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    conn.execute("COMMIT")


def get_conn():
    """FastAPI dependency: one connection per HTTP request, always closed afterwards."""
    conn = connect(config.db_path())
    try:
        yield conn
    finally:
        conn.close()
