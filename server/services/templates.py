"""Entity templates: each entity type has an ordered list of topics (knowledge sections).

Removing a topic from a template never touches existing knowledge: entries in that topic still show.
"""
import re

from ..util import new_id, now
from . import history
from .errors import Invalid
from .history import rows


def _slug(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_") or new_id()  # Thai-only names have no slug


def create_section(conn, label: str) -> dict:
    """A new topic, or the existing one if this name is already used."""
    existing = conn.execute("SELECT * FROM knowledge_section WHERE lower(label) = lower(?) AND archived_at IS NULL",
                            (label,)).fetchone()
    if existing:
        return dict(existing)
    section_id = _slug(label)
    if conn.execute("SELECT 1 FROM knowledge_section WHERE id = ?", (section_id,)).fetchone():
        section_id = f"{section_id}_{new_id()[-8:]}"
    order = conn.execute("SELECT coalesce(max(sort_order), 0) + 10 FROM knowledge_section").fetchone()[0]
    conn.execute("INSERT INTO knowledge_section (id, label, sort_order) VALUES (?, ?, ?)", (section_id, label, order))
    return history.get_row(conn, "knowledge_section", section_id)


def _set_sections(conn, type_id: str, sections: list[str]) -> None:
    conn.execute("DELETE FROM entity_type_section WHERE entity_type_id = ?", (type_id,))
    conn.executemany("INSERT INTO entity_type_section (entity_type_id, section_id, sort_order) VALUES (?, ?, ?)",
                     [(type_id, s, i) for i, s in enumerate(dict.fromkeys(sections), start=1)])


def create_template(conn, label: str, sections: list[str]) -> dict:
    type_id = _slug(label)
    if conn.execute("SELECT 1 FROM entity_type WHERE id = ?", (type_id,)).fetchone():
        raise Invalid(f"A template called “{label}” already exists.")
    conn.execute("INSERT INTO entity_type (id, label) VALUES (?, ?)", (type_id, label))
    _set_sections(conn, type_id, sections)
    return history.get_row(conn, "entity_type", type_id)


def update_template(conn, type_id: str, label: str | None, sections: list[str] | None) -> dict:
    history.get_row(conn, "entity_type", type_id)
    if label:
        conn.execute("UPDATE entity_type SET label = ? WHERE id = ?", (label, type_id))
    if sections is not None:
        _set_sections(conn, type_id, sections)
    return history.get_row(conn, "entity_type", type_id)


def archive_template(conn, type_id: str) -> None:
    template = history.get_row(conn, "entity_type", type_id)
    if template["is_builtin"]:
        raise Invalid("Built-in templates cannot be deleted, but you can change their topics.")
    used = conn.execute("SELECT COUNT(*) FROM entity WHERE entity_type_id = ?", (type_id,)).fetchone()[0]
    if used:
        raise Invalid(f"{used} entities use this template. Change their type first.")
    conn.execute("UPDATE entity_type SET archived_at = ? WHERE id = ?", (now(), type_id))


def list_images(conn, entity_id: str) -> list[dict]:
    history.get_row(conn, "entity", entity_id)
    return rows(conn, """SELECT id, entity_id, media_type, created_at FROM entity_image
                         WHERE entity_id = ? AND archived_at IS NULL ORDER BY created_at""", (entity_id,))


MAX_IMAGE_BYTES = 8 * 1024 * 1024


def sniff_image(data: bytes) -> str | None:
    """The real type from the file's first bytes (never trust the name; SVG can carry scripts, so it is refused)."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def add_image(conn, entity_id: str, data: bytes) -> dict:
    history.require_active(history.get_row(conn, "entity", entity_id), "entity")
    if len(data) > MAX_IMAGE_BYTES:
        raise Invalid("Images can be at most 8 MB.")
    media_type = sniff_image(data)
    if media_type is None:
        raise Invalid("Please choose a PNG, JPEG, GIF or WebP image.")
    image_id, created = new_id(), now()
    conn.execute("INSERT INTO entity_image (id, entity_id, media_type, data, created_at) VALUES (?, ?, ?, ?, ?)",
                 (image_id, entity_id, media_type, data, created))
    return {"id": image_id, "entity_id": entity_id, "media_type": media_type, "created_at": created}


def archive_image(conn, image_id: str) -> None:
    history.get_row(conn, "entity_image", image_id)
    conn.execute("UPDATE entity_image SET archived_at = ? WHERE id = ?", (now(), image_id))
