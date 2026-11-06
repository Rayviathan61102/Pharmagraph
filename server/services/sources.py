"""Sources (textbooks, papers, guidelines, slides ...) and evidence links to individual claims."""
from ..util import new_id, now
from . import history
from .errors import Invalid
from .history import rows

SOURCE_FIELDS = ("source_type", "title", "authors", "organization", "publication_date", "edition", "version_label",
                 "doi", "url", "isbn", "jurisdiction", "language", "lecture_id", "supersedes_source_id", "notes")

# Evidence points at exactly one claim: a knowledge entry or a relationship.
EVIDENCE_COLUMN = {"knowledge_entry": "knowledge_entry_id", "relationship": "relationship_id"}


# ---------- Sources ----------

def create_source(conn, **fields) -> dict:
    source_id, t = new_id(), now()
    data = {k: fields.get(k) for k in SOURCE_FIELDS}
    columns = ", ".join(data)
    conn.execute(f"INSERT INTO source (id, {columns}, imported_at, updated_at) "
                 f"VALUES (?, {', '.join('?' * len(data))}, ?, ?)", (source_id, *data.values(), t, t))
    return history.get_row(conn, "source", source_id)


def update_source(conn, source_id: str, changes: dict) -> dict:
    """Source details (title, edition, DOI ...) are bibliographic facts, not claims, so no revision is kept."""
    unknown = set(changes) - set(SOURCE_FIELDS)
    if unknown:
        raise Invalid(f"Unknown source fields: {', '.join(sorted(unknown))}")
    history.get_row(conn, "source", source_id)
    if changes:
        assignments = ", ".join(f"{column} = ?" for column in changes)
        conn.execute(f"UPDATE source SET {assignments}, updated_at = ? WHERE id = ?",
                     (*changes.values(), now(), source_id))
    return history.get_row(conn, "source", source_id)


def archive_source(conn, source_id: str) -> dict:
    history.get_row(conn, "source", source_id)
    conn.execute("UPDATE source SET archived_at = ? WHERE id = ? AND archived_at IS NULL", (now(), source_id))
    return history.get_row(conn, "source", source_id)


def list_sources(conn, q: str | None = None, include_archived: bool = False) -> list[dict]:
    q = (q or "").strip().lower()
    return rows(conn, """
        SELECT * FROM source
        WHERE (? OR archived_at IS NULL)
          AND (? = '' OR instr(lower(title), ?) > 0 OR instr(lower(coalesce(authors, '') || ' '
               || coalesce(organization, '')), ?) > 0)
        ORDER BY title COLLATE NOCASE LIMIT 200""", (include_archived, q, q, q))


# ---------- Evidence ----------

def evidence_for(conn, table: str, ids: list[str], include_archived: bool = False) -> dict[str, list[dict]]:
    """Evidence (with its source's details) for many entries or relationships at once."""
    column = EVIDENCE_COLUMN[table]
    result: dict[str, list[dict]] = {i: [] for i in ids}
    if not ids:
        return result
    marks = ", ".join("?" * len(ids))
    for ev in rows(conn, f"""
            SELECT ev.*, s.title AS source_title, s.source_type, s.authors, s.organization, s.publication_date,
                   s.edition, s.jurisdiction, s.url, s.doi, s.archived_at AS source_archived_at
            FROM evidence_link ev JOIN source s ON s.id = ev.source_id
            WHERE ev.{column} IN ({marks}) AND (? OR ev.archived_at IS NULL)
            ORDER BY ev.created_at""", (*ids, include_archived)):
        result[ev[column]].append(ev)
    return result


def create_evidence(conn, *, source_id: str, knowledge_entry_id: str | None = None,
                    relationship_id: str | None = None, stance: str = "supports", evidence_type: str = "other",
                    claim_text: str | None = None, locator: str | None = None, passage: str | None = None,
                    verification_notes: str | None = None) -> dict:
    if (knowledge_entry_id is None) == (relationship_id is None):
        raise Invalid("Evidence must be attached to exactly one knowledge entry or relationship.")
    table = "knowledge_entry" if knowledge_entry_id else "relationship"
    claim = history.get_row(conn, table, knowledge_entry_id or relationship_id)
    history.require_active(claim, table)
    if history.get_row(conn, "source", source_id)["archived_at"]:
        raise Invalid("This source is archived. Restore it or choose another source.")
    evidence_id = new_id()
    conn.execute("""
        INSERT INTO evidence_link (id, source_id, knowledge_entry_id, relationship_id, stance, evidence_type,
                                   claim_text, locator, passage, verification_notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                 (evidence_id, source_id, knowledge_entry_id, relationship_id, stance, evidence_type,
                  claim_text, locator, passage, verification_notes, now()))
    evidence = history.get_row(conn, "evidence_link", evidence_id)
    # Spec 4.4: a contradicting source should prompt the user; we never change the status silently.
    evidence["suggest_disputed"] = stance == "contradicts" and claim["status_code"] != "disputed"
    return evidence


def archive_evidence(conn, evidence_id: str) -> dict:
    history.get_row(conn, "evidence_link", evidence_id)
    conn.execute("UPDATE evidence_link SET archived_at = ? WHERE id = ? AND archived_at IS NULL", (now(), evidence_id))
    return history.get_row(conn, "evidence_link", evidence_id)


# ---------- Status changes and reviews ----------

def change_status(conn, table: str, row_id: str, to_status: str, notes: str, reviewed_by: str = "user") -> dict:
    """Record a review. If the status differs, also change it (with a revision).

    A review with the SAME status is allowed: it records "checked again, still valid".
    """
    if not (notes or "").strip():
        raise Invalid("Please say why (for example which source you checked).")
    if to_status == "verified" and reviewed_by != "user":
        raise Invalid("Only you can mark information as Verified.")  # AI never self-verifies (spec 4.3)
    row = history.get_row(conn, table, row_id)
    history.require_active(row, table)
    if not conn.execute("SELECT 1 FROM verification_status WHERE code = ?", (to_status,)).fetchone():
        raise Invalid(f"Unknown status: {to_status}")
    conn.execute(f"""
        INSERT INTO review (id, {history.REVISION_COLUMN[table]}, from_status_code, to_status_code, reviewed_by,
                            notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)""", (new_id(), row_id, row["status_code"], to_status, reviewed_by, notes, now()))
    if to_status != row["status_code"]:
        conn.execute(f"UPDATE {table} SET status_code = ? WHERE id = ?", (to_status, row_id))
        history.bump(conn, table, row_id, "status_change", notes, reviewed_by)
    return history.get_row(conn, table, row_id)


def reviews(conn, table: str, row_id: str) -> list[dict]:
    history.get_row(conn, table, row_id)
    return rows(conn, f"SELECT * FROM review WHERE {history.REVISION_COLUMN[table]} = ? ORDER BY created_at DESC",
                (row_id,))
