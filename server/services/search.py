"""Full-text search over entity names, other names, descriptions and knowledge entries.

Uses SQLite FTS5 with the 'trigram' tokenizer: it matches any piece of text of 3+ characters,
which also works for Thai (written without spaces between words). Shorter queries use a plain scan.
"""


def rows(conn, sql, params=()) -> list[dict]:  # (history.py imports this module, so it can't import history)
    return [dict(r) for r in conn.execute(sql, params)]


HIGHLIGHT_START, HIGHLIGHT_END = "\u0002", "\u0003"  # invisible markers the interface turns into highlights

# Everything searchable about one entity. Kept in one place so the index always matches the data.
INDEX_SQL = """
    INSERT INTO search_index (entity_id, field, text)
    SELECT id, 'name', name FROM entity WHERE id = :id
    UNION ALL SELECT id, 'description', description FROM entity WHERE id = :id AND description IS NOT NULL
    UNION ALL SELECT entity_id, 'alias', alias FROM entity_alias WHERE entity_id = :id AND archived_at IS NULL
    UNION ALL SELECT entity_id, 'entry', coalesce(title || char(10), '') || body FROM knowledge_entry
              WHERE entity_id = :id AND archived_at IS NULL"""


def reindex_entity(conn, entity_id: str) -> None:
    """Rebuild one entity's search rows. Called automatically after every change (see history.record)."""
    conn.execute("DELETE FROM search_index WHERE entity_id = ?", (entity_id,))
    conn.execute(INDEX_SQL, {"id": entity_id})


def _window(text: str, q: str, width: int = 40) -> str:
    """A short piece of `text` around the first match of `q`, with the match marked (like FTS5's snippet)."""
    at = text.lower().find(q.lower())
    start, end = max(0, at - width), at + len(q) + width
    return ("…" if start else "") + text[start:at] + HIGHLIGHT_START + text[at:at + len(q)] + HIGHLIGHT_END \
        + text[at + len(q):end] + ("…" if end < len(text) else "")


def search(conn, q: str, include_archived: bool = False, limit: int = 30) -> list[dict]:
    q = q.strip()
    if not q:
        return []
    if len(q) >= 3:
        # Each word must appear (as a piece of text); quoting makes punctuation in the query harmless.
        words = [w for w in q.split() if len(w) >= 3] or [q]
        match = " ".join('"' + w.replace('"', '""') + '"' for w in words)
        hits = rows(conn, f"""
            SELECT entity_id, field, rank,
                   snippet(search_index, 2, '{HIGHLIGHT_START}', '{HIGHLIGHT_END}', '…', 64) AS snippet
            FROM search_index WHERE search_index MATCH ? ORDER BY rank LIMIT 500""", (match,))
    else:
        # Too short for trigrams (e.g. "5H"): scan the index text directly.
        hits = rows(conn, """
            SELECT entity_id, field, 0 AS rank, text AS snippet FROM search_index
            WHERE instr(lower(text), lower(?)) > 0 LIMIT 500""", (q,))
        for h in hits:
            h["snippet"] = _window(h["snippet"], q)

    best: dict[str, dict] = {}  # entity -> its best hit, plus every field that matched
    for h in hits:
        found = best.setdefault(h["entity_id"], {**h, "matched": []})
        if h["field"] not in found["matched"]:
            found["matched"].append(h["field"])
    if not best:
        return []

    marks = ", ".join("?" * len(best))
    entities = {e["id"]: e for e in rows(conn, f"""
        SELECT e.id, e.name, e.entity_type_id, t.label AS type_label, e.status_code, e.archived_at
        FROM entity e JOIN entity_type t ON t.id = e.entity_type_id
        WHERE e.id IN ({marks}) AND (? OR e.archived_at IS NULL)""", (*best, include_archived))}

    def priority(entity_id: str):
        hit, name = best[entity_id], entities[entity_id]["name"].lower()
        exact = name == q.lower()
        by_name = bool({"name", "alias"} & set(hit["matched"]))
        return (not exact, not by_name, hit["rank"], name)

    ordered = sorted(entities, key=priority)[:limit]
    return [{**entities[i], "matched": best[i]["matched"],
             "snippet": best[i]["snippet"] if best[i]["field"] in ("entry", "description") else None}
            for i in ordered]
