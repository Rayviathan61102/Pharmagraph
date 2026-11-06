"""Small helpers used everywhere: new IDs and timestamps."""
import uuid
from datetime import datetime, timezone


def new_id() -> str:
    """A UUID version 7: unique forever, and IDs created later sort after earlier ones."""
    return str(uuid.uuid7())


def now() -> str:
    """The current time in UTC, e.g. '2026-11-06T09:30:00.123Z'."""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
