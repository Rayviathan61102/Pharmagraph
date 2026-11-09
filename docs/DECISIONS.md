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

## M9 — Backup and restore

- Backup = zip with `pharmagraph.db` (made with SQLite's backup API) + `manifest.json` (kind, time,
  schema version, database id, row counts per table, SHA-256). Written as `.partial` then renamed, so a
  half-written backup never looks real. Every new backup is validated immediately.
- Restore: validate → automatic `pre-restore` backup → upgrade the temporary copy if it is older →
  copy it INTO the live database with the backup API (no file swapping, works while the file is open).
- Backups from a newer app version are refused. Backup names are checked against a strict pattern
  (no paths), so requests cannot reach other files.
- Startup makes a `pre-migration` backup whenever an existing database needs upgrading.
- Reminder: shown when the knowledge base has data and the newest backup is 30+ days old (or none).
  A true background schedule needs desktop packaging (analysis T3).
- shortcut: documents/images (`files/` folder) are not in backups yet because they do not exist until
  Stage 2; add them to `create_backup` then.
- Uploading a backup through the interface is not built; copy the zip into the backups folder instead.

## Chemical structures and metabolites (requested 2026-11-07, ahead of Stage 2/4)

- **Format: SMILES**, drawn and checked in the browser with **RDKit.js** (BSD, WebAssembly, bundled so it
  works offline, loaded only when a structure is shown). RDKit computes canonical SMILES, formula (from its
  atom list) and molecular weight; the toolkit version is stored with them (analysis T2). Server-side
  Python RDKit was not used: it has no Python 3.15 build yet, and the browser needs RDKit for drawing anyway.
- Under **Chemical properties** there are now two subheaders: **Chemical structure** and **Metabolites**.
  Double-click a structure (or "Open details") to open `#/structure/<id>`.
- **Highlights** (`structure_annotation`): a set of atom numbers + explanation + glow colour + status.
  Atoms are picked by clicking the drawing or by a SMARTS pattern (e.g. `C#C`). Atom numbers refer to the
  structure's entered SMILES, which is therefore never edited: a new SMILES = a new structure.
  Editing a highlight creates a new version (`replaces_id`) and archives the old one; "Earlier versions"
  shows them all. Highlights carry a status so speculation is not shown as established SAR (spec 6.2).
- Glows are hidden by default. A feature glows (with its note and leader line) while the mouse points at
  one of its atoms or bonds, or while it is pinned by clicking its text in the feature list (click again to
  unpin). The highlight being edited always glows. The same hover works on the small drawing on the entity page.
- The glow is drawn by the app (blurred shapes under RDKit's drawing) and the leader line runs from the
  centre of the highlighted atoms straight out past the molecule. Atom positions are read from the class
  names RDKit puts on its SVG (`bond-N atom-A atom-B`, `atom-N`).
  shortcut: the dark-theme recolouring swaps RDKit's fixed colours in the SVG text (see `chem.ts`).
  Overlapping notes are not pushed apart yet; with many highlights on one side, labels can collide.
- **Metabolites** reuse relationships: `drug —HAS_METABOLITE→ metabolite` with conditions
  `metabolite_activity` (active, inactive, hepatotoxic, neurotoxic …, several allowed), `formed_by`
  (an enzyme entity) and `metabolic_pathway`. So they get history, sources, statuses and graph display for
  free, and the metabolite's own page shows "metabolite of …". New entity type `metabolite`.
- Metabolite **share** (migration 005): condition `metabolite_share`, holding "Major"/"Minor" and/or a
  percentage such as "55%". Metabolites can be **edited** (one PUT replaces the activity, enzyme, pathway
  and share conditions as a single new version; other conditions on the link are kept) and **removed**
  (archived). Metabolites tagged *inactive* are hidden unless "Show inactive metabolites" is ticked.
- Not done: attaching a *source* to a structure or to a highlight (sources currently attach to entries and
  relationships only); 3D structures.

## M11 — Two-panel workspace

- Each panel keeps its own history of addresses (`/entity/<id>`, `/graph/<id>` …). Every link in the app
  is an address; when it changes, the **active** panel (last clicked or focused) shows it, and the address
  bar always mirrors the active panel. So existing links needed no changes.
- At most two panels is built into the code (`MAX_PANELS = 2`). Layout (panels, histories, arrangement,
  split) is saved in the browser's local storage, not in the database: it is display state, not knowledge.
- An address opened directly (bookmark, new tab) goes into the active panel, overriding the saved view.
- Divider: drag, or focus it and use the arrow keys (25–75%). Narrow windows (≤ 900 px) show tabs.
- The graph re-measures itself when its panel is resized. Wide tables scroll inside their own box.
- Not done (optional in the spec): highlighting concepts that are visible in both graph panels.

## M12 — Personal notes

- `user_note` (in the schema since M1): attached to at most one entity, knowledge entry, relationship or
  source, or to nothing (the inbox). Stages inbox → draft → connected → reviewed → verified.
- Notes are personal, so editing a note simply updates it (no revision history), and notes are not in the
  search index yet. Notes never touch the row they are attached to (tested).

## M13 — Acceptance and speed

- See [ACCEPTANCE.md](ACCEPTANCE.md). `server/tools/benchmark.py` builds a 50k-entity / 300k-relationship
  database and times the queries; all are well under the targets.
- Backup copies into a temporary file with SQLite's crash protection off (the copy is fully checked
  afterwards), which made copying ~5x faster. Restores into the live database keep full protection.

## Templates, images and comparison (requested 2026-11-09)

- A **template** is an entity type's ordered topic list (`entity_type_section.sort_order`, migration 006), so
  custom templates are new entity types and entity pages need no separate mechanism. Filled-in boxes are
  saved with the entity in one transaction.
- **Images** are stored in the database (`entity_image`), so backups and moving computers include them.
  PNG/JPEG/GIF/WebP only, checked from the file's bytes; SVG is refused because it can carry scripts. 8 MB limit.
- **Compare** is built in the browser from existing data; rows with nothing on either side are hidden.
- Deleted categories take their subfolders with them and are archived; entities are not touched.

## M10 — Graph (one panel)

- Server: `POST /api/graph/expand` (up to 25 neighbours not already on screen, plus how many remain;
  verified links first) and `POST /api/graph/view` (links among visible nodes + hidden-neighbour counts).
  At most 500 nodes per request; the interface warns above 300.
- No automatic layout: new neighbours are placed in a ring (or an outward arc) around the expanded
  node, and nothing already on screen moves. Dragged nodes stay where you put them.
- Hidden-neighbour counts ("+23") are drawn inside the node as a small image, not in the label. Labels
  are set once (the name) and never change afterwards: changing a label's text after Cytoscape had cached
  its picture sometimes left labels cropped (seen on the user's screen, not reproducible here). The graph
  also waits for the bundled fonts before drawing labels.
- Collapse removes what that node's expansion added (recursively), never the focus.
- Back/Forward step through earlier focus entities; the view around them is rebuilt fresh.
- Filters: one relationship type (or all) and the three scopes. Changing a filter rebuilds the view.
- The graph page address (`#/graph/<id>`) keeps the first focus; refocusing inside the panel does not
  change the address yet (M11 will keep per-panel state).
