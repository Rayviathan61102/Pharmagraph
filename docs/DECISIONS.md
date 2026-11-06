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
