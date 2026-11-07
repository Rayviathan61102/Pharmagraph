# PharmaGraph user guide

PharmaGraph is your personal, local scientific knowledge base. Everything stays on your computer and works
offline. This guide covers the first full version (MVP).

---

## 1. Starting and stopping

1. Open a terminal in the project folder (`C:\The codex\Spaghettification`).
2. Start the app:
   ```
   .venv\Scripts\python -m server
   ```
3. Open **http://127.0.0.1:8000** in your browser.
4. To stop it, press **Ctrl+C** in the terminal.

Your knowledge lives in `C:\Users\<you>\PharmaGraph-Data` (the program code is elsewhere, so updating the
app never touches your data).

## 2. Three rules PharmaGraph always follows

- **Nothing is ever deleted.** "Archive" hides an item; "Show archived" brings it back, with its history.
- **Every change is kept.** Each entity, entry and relationship has a *History* with every earlier version
  and the reason you gave.
- **Kinds of knowledge never mix.** General science (blue, solid line), lecture-specific (violet, dashed)
  and personal (green, dotted) are stored separately, even about the same drug.

## 3. Entities (the concepts)

- **+ New entity** (top left): name, type (drug, disease, enzyme …), short description, other names
  (synonyms, Thai name, abbreviations – separated by commas).
- If the name or an alias already exists, you get a warning with a link to the existing entity.
- On an entity page: **Edit**, **Archive**, add/remove other names, add it to sidebar categories.
- Click the **status badge** (Proposed, Verified …) to change or re-confirm the status. A reason is
  required, and every review is kept.

## 4. Knowledge entries

Each section (Overview, Mechanism, Pharmacokinetics, Dosage …) has **+ Add**. You first choose the kind:

| Choice | Use it for |
|---|---|
| General scientific knowledge | Established science, ideally with a source |
| Lecture-specific | A professor's explanation, terms or exam focus (pick or create the lecture) |
| Personal | Your own notes, mnemonics, unverified ideas |
| Both general and lecture | Saves two linked entries that never overwrite each other |

Text uses **Markdown**: `**bold**`, `- list item`, `# heading`.
Under each entry: **+ Condition** (e.g. *Population: adults*, *Jurisdiction: TH*), **+ Source**, **+ Note**.
Unverified Dosage / Contraindications / Interactions entries show a caution. General claims without a
source show "no source yet".

## 5. Relationships ("Related concepts")

**+ Add relationship**: choose the wording from this entity's point of view ("inhibits", "is treated by" …),
search the other entity, optionally add a mechanism, a condition and the kind (general / lecture /
personal). The other entity's page shows it the other way round ("inhibited by").
The same two entities can be linked several times with different conditions.

## 6. Sources and evidence

**+ Source** on an entry or relationship: pick an existing source or create one (textbook, guideline,
paper, slides …), then say whether it *supports* or *contradicts* the claim and give the page.
If a source contradicts a claim, PharmaGraph asks whether to mark the claim **Disputed** – it never does
so silently. The **Sources** section at the bottom of a page lists every source cited on it.

## 7. Chemical structure and metabolites

Under **Chemical properties**:

- **+ Add structure**: paste a SMILES (from PubChem: "Isomeric SMILES"). You see a live drawing, the
  formula and molecular weight before saving.
- **Double-click the drawing** (or "Open details") for the structure page:
  - **+ New highlight**: click atoms on the drawing (or type a pattern such as `C#C` for a triple bond),
    write the explanation, pick a glow colour, set a status.
  - Point at a highlighted part of the molecule to make it glow with its explanation, or **click a
    feature's text** in the list to keep it glowing (click again to stop).
  - **Edit** keeps every earlier version ("Earlier versions").
- **Metabolites**: **+ Add metabolite** – pick or create the metabolite, mark Major/Minor and/or a
  percentage, tick activity/toxicity (active, hepatotoxic, neurotoxic …), choose the enzyme that forms it
  and the pathway. Inactive metabolites are hidden unless you tick **Show inactive metabolites**.
  **Edit** / **Remove** on each row.

## 8. Finding things

- **Search box** (sidebar): names, other names, Thai text, words inside your entries. Results show why
  they matched.
- **Categories** (sidebar): folders for navigation. One entity can be in several folders. Use **+** / **⋯**
  next to a folder to add a subfolder, rename, move or archive it. Keyboard: Tab, Enter/Space.

## 9. The graph

**Open in graph** on an entity page.

| You do | What happens |
|---|---|
| Click a node | Details appear on the right |
| Double-click | Show its neighbours (25 at a time); double-click again to hide them |
| Alt + click | Make it the centre; **←/→** go back/forward |
| Right-click | Menu: details, second panel, make focus, show more, collapse |
| Drag / wheel | Move nodes, pan, zoom; **Fit** shows everything |

"+12" under a name means 12 more neighbours are hidden. Filters at the top limit the relationship type
and the kinds of knowledge shown.

## 10. Two panels

- **+ Second panel** (panel header) or **"… in second panel"** buttons open a second view, e.g. a graph
  next to an entity page. At most two panels.
- Links open in the panel you last clicked in (it has a blue outline). Each panel has its own **← →**.
- **⇄ Swap**, **Stack panels vertically**, drag the line between panels to resize (or focus it and use
  the arrow keys), **✕** to close a panel. The layout is remembered.
- On a narrow window the two panels become tabs.

## 11. Personal notes

- **Notes** (bottom of the sidebar): a quick-note box and your **Inbox** of loose notes. Later, **Attach
  to an entity**. Each note has a stage: inbox → draft → connected → reviewed → verified.
- **My notes** on an entity page, and **+ Note** under any entry. Notes never change the entry they are on.

## 12. Backups – do this regularly

- **Backups** (bottom of the sidebar) → **Back up now**. The backup is checked immediately.
- A reminder appears when your last backup is more than 30 days old.
- Automatic backups are also made **before every restore** and **before the app upgrades the database**.
- **Restore** replaces the current knowledge base with a backup – after first saving the current state, so
  a restore can be undone.
- **Moving to another computer:** install PharmaGraph there (see the README), copy a backup `.zip` into its
  `PharmaGraph-Data\backups` folder, open **Backups** and **Restore** it. Also use **Download** to keep
  copies somewhere else (USB drive, cloud folder).

## 13. If something looks wrong

| Problem | Try |
|---|---|
| A change made elsewhere does not show | Reload the page (F5) |
| "Rejected by the database: …" | The database refused something unsafe; nothing was saved – read the message |
| The page will not load | Is the terminal running `python -m server`? Look there for an error |
| Something was archived by mistake | Tick "Show archived …" and click **Restore** |
| Data seems lost | Backups → Restore the latest good backup |
