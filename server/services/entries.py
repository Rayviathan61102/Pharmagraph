"""Knowledge entries (general / lecture / personal), lectures and professors."""
from ..util import new_id, now
from . import contexts, history, sources
from .errors import Invalid
from .history import rows

AI_ALLOWED_STATUSES = ("proposed", "needs_review")  # AI output is never verified automatically (spec 4.3)


# ---------- Professors and lectures ----------

def create_professor(conn, *, name: str, department: str | None = None, notes: str | None = None) -> dict:
    professor_id = new_id()
    conn.execute("INSERT INTO professor (id, name, department, notes, created_at) VALUES (?, ?, ?, ?, ?)",
                 (professor_id, name, department, notes, now()))
    return history.get_row(conn, "professor", professor_id)


def list_professors(conn) -> list[dict]:
    return rows(conn, "SELECT * FROM professor WHERE archived_at IS NULL ORDER BY name")


def create_lecture(conn, *, title: str, course_code: str | None = None, course_name: str | None = None,
                   professor_id: str | None = None, lecture_date: str | None = None,
                   academic_year: str | None = None, notes: str | None = None) -> dict:
    lecture_id = new_id()
    conn.execute("""
        INSERT INTO lecture (id, title, course_code, course_name, professor_id, lecture_date, academic_year,
                             notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                 (lecture_id, title, course_code, course_name, professor_id, lecture_date, academic_year, notes, now()))
    return history.get_row(conn, "lecture", lecture_id)


def list_lectures(conn) -> list[dict]:
    return rows(conn, """
        SELECT l.*, p.name AS professor_name FROM lecture l
        LEFT JOIN professor p ON p.id = l.professor_id
        WHERE l.archived_at IS NULL
        ORDER BY l.course_code, l.lecture_date, l.title""")


# ---------- Knowledge entries ----------

ENTRY_SELECT = """
    SELECT k.*, l.title AS lecture_title, p.name AS professor_name, s.label AS section_label,
           s.sort_order AS section_order
    FROM knowledge_entry k
    JOIN knowledge_section s ON s.id = k.section_id
    LEFT JOIN lecture l ON l.id = k.lecture_id
    LEFT JOIN professor p ON p.id = l.professor_id"""

SCOPE_ORDER = "CASE k.scope WHEN 'general' THEN 0 WHEN 'lecture' THEN 1 ELSE 2 END"


def _with_contexts(conn, found: list[dict]) -> list[dict]:
    """Attach each entry's conditions and evidence."""
    ids = [e["id"] for e in found]
    conditions = contexts.contexts_for(conn, "knowledge_entry", ids)
    evidence = sources.evidence_for(conn, "knowledge_entry", ids)
    for e in found:
        e["contexts"] = conditions[e["id"]]
        e["evidence"] = evidence[e["id"]]
    return found


def get_entry(conn, entry_id: str) -> dict:
    history.get_row(conn, "knowledge_entry", entry_id)  # 404 if missing
    return _with_contexts(conn, rows(conn, f"{ENTRY_SELECT} WHERE k.id = ?", (entry_id,)))[0]


def list_entries(conn, entity_id: str, include_archived: bool = False) -> list[dict]:
    history.get_row(conn, "entity", entity_id)
    return _with_contexts(conn, rows(conn, f"""{ENTRY_SELECT}
        WHERE k.entity_id = ? AND (? OR k.archived_at IS NULL)
        ORDER BY s.sort_order, {SCOPE_ORDER}, k.sort_order, k.created_at""", (entity_id, include_archived)))


def _insert_entry(conn, entity_id, scope, section_id, body, title, lecture_id, status_code, origin) -> str:
    entry_id, t = new_id(), now()
    conn.execute("""
        INSERT INTO knowledge_entry (id, entity_id, scope, section_id, title, body, lecture_id, status_code,
                                     origin, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                 (entry_id, entity_id, scope, section_id, title, body, lecture_id, status_code, origin, t, t))
    return entry_id


def create_entry(conn, *, entity_id: str, scope: str, section_id: str, body: str, title: str | None = None,
                 lecture_id: str | None = None, lecture_body: str | None = None,
                 status_code: str = "proposed", origin: str = "user") -> list[dict]:
    """Create one entry, or two linked entries when scope is 'both' (spec 3.3). Returns the created entries."""
    history.require_active(history.get_row(conn, "entity", entity_id), "entity")
    if scope not in ("general", "lecture", "personal", "both"):
        raise Invalid("Scope must be general, lecture, personal or both.")
    if origin == "ai" and status_code not in AI_ALLOWED_STATUSES:
        raise Invalid("AI-generated information must start as Proposed or Needs review.")
    if lecture_id and scope not in ("lecture", "both"):
        raise Invalid("Only lecture-specific information can be linked to a lecture.")

    if scope != "both":
        entry_id = _insert_entry(conn, entity_id, scope, section_id, body, title, lecture_id, status_code, origin)
        history.record(conn, "knowledge_entry", entry_id, "create", changed_by=origin)
        return [get_entry(conn, entry_id)]

    # "Both": two separate entries that point at each other. Editing one never changes the other.
    general_id = _insert_entry(conn, entity_id, "general", section_id, body, title, None, status_code, origin)
    lecture_entry_id = _insert_entry(conn, entity_id, "lecture", section_id, lecture_body or body, title,
                                     lecture_id, status_code, origin)
    conn.execute("UPDATE knowledge_entry SET counterpart_entry_id = ? WHERE id = ?", (lecture_entry_id, general_id))
    conn.execute("UPDATE knowledge_entry SET counterpart_entry_id = ? WHERE id = ?", (general_id, lecture_entry_id))
    for entry_id in (general_id, lecture_entry_id):
        history.record(conn, "knowledge_entry", entry_id, "create", changed_by=origin)
    return [get_entry(conn, general_id), get_entry(conn, lecture_entry_id)]


EDITABLE = {"title", "body", "section_id", "lecture_id"}  # scope is fixed; status goes through review (M5)


def update_entry(conn, entry_id: str, changes: dict, reason: str | None = None) -> dict:
    unknown = set(changes) - EDITABLE
    if unknown:
        raise Invalid(f"These fields cannot be edited here: {', '.join(sorted(unknown))}")
    entry = history.get_row(conn, "knowledge_entry", entry_id)
    if changes.get("lecture_id") and entry["scope"] != "lecture":
        raise Invalid("Only lecture-specific information can be linked to a lecture.")
    history.update_fields(conn, "knowledge_entry", entry_id, changes, reason)
    return get_entry(conn, entry_id)
