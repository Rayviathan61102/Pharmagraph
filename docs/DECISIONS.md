# Decisions log

Short record of decisions and of any place where the code differs from
[PharmaGraph-Analysis.md](PharmaGraph-Analysis.md). Newest at the bottom.

## 2026-11-06 — Approved before implementation

- Platform: local web server first (Python + FastAPI + SQLite, React interface). Desktop packaging later.
- "Delete" always means archive. Nothing is permanently removed.
- D1–D13 from analysis section 10 approved as recommended:
  scope separate from status; archive is a flag; personal entries and notes both kept; drug classes are
  entities linked with IS_A; layers rule-based (Stage 2); basic revision history in the MVP; sidebar and
  inspector are not "panels"; English interface first; lecture link encouraged, not forced; new items
  default to "Proposed"; edit reason optional except for status changes; React + TypeScript;
  bookmarks/inbox/lifecycle in Stage 2, clinical pathway in Stage 4.

## M1 — Database foundation

- `schema_migration` is created by `migrate.py` itself (it must exist before `001_initial.sql` runs).
- `entity_type_section` has no `sort_order`: sections always follow the one global order in
  `knowledge_section.sort_order`, which matches spec 15.2.
- Aliases are protected by a no-delete trigger too (they are archived, like everything else).
- Transactions are explicit (`with transaction(conn):`). Python's hidden transaction handling is off.

## M2–M8 — Implementation notes

- **One gatekeeper:** `services/history.py` is the only path that changes entities, entries and
  relationships. It saves a full snapshot revision and refreshes the search index on every change.
- **Aliases and conditions are part of their owner's history:** adding/removing an alias bumps the
  entity's version; adding/removing a condition bumps the entry's/relationship's version. A removed
  condition row is deleted, but the previous revision's snapshot still contains it.
- **Scope is fixed after creation** (general/lecture/personal). Relationship endpoints are fixed too:
  to change them, archive and create a new one. This keeps each history meaningful.
- **Status changes only through reviews** (`POST /api/{kind}/{id}/status`), always with a written reason.
  A review with the same status is allowed ("re-checked, still valid") and adds no new version.
  Only the user can set Verified; AI-origin content must start as Proposed or Needs review.
- **Contradicting evidence** returns `suggest_disputed`; the interface asks before marking Disputed.
  Nothing changes status silently.
- **Source details** (title, edition, DOI …) are bibliographic facts, not claims, so editing them keeps
  no revision.
- **Conditions also work on knowledge entries** (e.g. dosage "adults"), not only on relationships.
- **Search:** FTS5 trigram index of names, aliases, descriptions and entry text. Queries under
  3 characters scan instead. Migration `003_fill_search_index.sql` indexes data created before M6.
- **Categories** are navigation only: no revisions, can be moved (loops refused), archived.
- **Entity page (M8):** sections follow spec 15.2, then Related concepts, Sources (every cited source
  once, with the claims it supports) and History. General claims without a source show "no source yet";
  unverified Dosage / Contraindications / Interactions entries show a caution.
- **Known limitation:** reasons for archive and edits use the browser's simple prompt/fields; changes
  made outside the app (e.g. through /docs) appear after a page reload.
