# MVP acceptance check (M13)

Date: 2026-11-07 · App version 0.1.0 · Python 3.15.2 · SQLite 3.53.4 · 103 automated tests passing

This walks through the 12 criteria in spec **Section 21** ("The initial MVP should be considered successful
when the user can …"). Each one has automated tests (run `.venv\Scripts\python -m pytest`) and was also
tried by hand in the browser during development.

| # | Criterion (spec 21) | Automated test(s) | Checked in the browser |
|---|---|---|---|
| 1 | Create a scientific entity | `test_entities.py::test_create_entity_with_alias`, `test_acceptance.py` | Paracetamol, Ethinyl estradiol created through the form; duplicate warning shown for "acetaminophen" |
| 2 | Add general scientific information | `test_entries.py::test_general_and_lecture_entries_stay_separate` | Mechanism entry with Markdown |
| 3 | Add separate lecture-specific information to the same entity | `test_entries.py::test_both_creates_two_linked_entries` | "Both" → two linked entries, lecture + professor shown; editing one never changes the other |
| 4 | Connect two entities using a typed relationship | `test_relationships.py` (both directions, same pair with different conditions) | "Paracetamol inhibits Cyclooxygenase" / "inhibited by" from the enzyme |
| 5 | Attach a source to a specific knowledge claim or relationship | `test_sources.py::test_source_attaches_to_one_relationship_only` | Goodman & Gilman, p. 601 on one relationship only |
| 6 | Search for and retrieve an entity | `test_search.py` (alias piece, Thai, 2 letters, words in entries) | Thai "ราเซต", "peroxide", "CO" |
| 7 | Navigate through the hierarchical sidebar | `test_categories.py` (one entity in two folders, loops refused) | Tree opened with Enter/Space; chevrons; colour per top-level folder |
| 8 | Explore relationships using the graph | `test_graph.py` (25-neighbour limit, archived never shown, filters) | Expand/collapse, Alt+click refocus, Back/Forward, right-click menu, filters |
| 9 | Open two independent panels and rearrange them | — (interface behaviour) | Entity + graph side by side; separate Back/Forward; links open in the clicked panel; Swap; Stack; divider by keyboard; edit in one panel shows in the other; layout restored after reload; tabs on a narrow window; at most two panels |
| 10 | Add personal notes without overwriting scientific entries | `test_notes.py::test_note_on_an_entry_never_changes_the_entry` | Inbox note attached to an entity; note on an entry left the entry's text/version/time unchanged |
| 11 | Export a backup | `test_backup.py::test_backup_validates_and_lists` | "Back up now" → checked .zip; Download link |
| 12 | Restore a backup without losing relationships or information | `test_backup.py::test_round_trip_restores_exactly` (whole database identical), `test_restore_on_another_computer`, damaged/tampered/newer backups refused | Rename undone by restore; automatic "before a restore" backup listed |

**Result: all 12 criteria met.**

## Speed on a large knowledge base

`python -m server.tools.benchmark` builds a throw-away database with **50,000 entities, 50,000 aliases,
50,000 knowledge entries and 300,000 relationships** (282 MB, one entity with 2,000+ links) and times the
queries the interface uses. Run on this laptop, 2026-11-07:

| Operation | Time | Target (analysis 5.4) |
|---|---|---|
| Graph: expand an entity with 2,000+ neighbours (first 25) | 32 ms | < 100 ms ✔ |
| Graph: expand a typical entity | 0.4 ms | < 100 ms ✔ |
| Graph: links + hidden counts, 26 visible nodes | 33 ms | ✔ |
| Graph: links + hidden counts, 300 visible nodes | 87 ms | ✔ |
| Search: 5-letter piece of a name | 30 ms | < 300 ms ✔ |
| Search: two words | 59 ms | < 300 ms ✔ |
| Search: 2-character query | 7 ms | ✔ |
| Entity page: knowledge entries | 0.6 ms | ✔ |
| Entity page: 2,000+ relationships | 48 ms | ✔ |
| Backup (create + validate) | 25 s | — |
| Restore (validate + safety backup + restore) | 78 s | — |

Backup and restore time grows with database size; at this (very large) size most of it is SQLite's full
integrity check, which is what proves a backup is good, so it is kept. A realistic personal knowledge base
(a few thousand entities, a few MB) backs up and restores in about a second.

## Known limitations at the end of the MVP

- Archive and some reasons use the browser's simple prompt box.
- Changes made outside the app (e.g. the `/docs` test page) appear after a page reload.
- Shared concepts are not yet highlighted across the two graph panels (spec lists it as optional).
- Overlapping structure-note labels are not pushed apart; sources cannot yet be attached to structures.
- Backups contain the database only (documents/images arrive in Stage 2).
- Hover glows need a mouse; on touch screens use the feature list (click to pin).
- A real background backup schedule needs desktop packaging (analysis T3); the app reminds instead.
