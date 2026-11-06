# PharmaGraph — Specification Analysis, Architecture and Database Design

Version: 0.1 (for review)
Date: 2026-11-06
Based on: *PharmaGraph Master Project Specification v0.1* and *PharmaGraph-Overview* (task brief)
Status: **Analysis only. Nothing is implemented. Awaiting your approval.**

---

## How to read this document

Labels used throughout:

| Label | Meaning |
|---|---|
| **[Confirmed]** | Stated in the specification, or decided by you in conversation. |
| **[Recommendation]** | My technical suggestion. You can accept, change or reject it. |
| **[Decision needed]** | I need your answer before building that part. All of these are collected in **Section 10**. |

Decisions you have already made in conversation **[Confirmed]**:

1. **Platform:** start as a **local web server** (a small program on your computer that the browser talks to). Desktop packaging can come later.
2. **Delete means archive.** Nothing is ever permanently removed. "Deleting" hides the item and keeps its history.

> **Plain terms box.** Where a concept may be new to you, I add a box like this one. You can skip them if you already know the idea.

A word clash to watch out for: in pharmacy, **API** means *Active Pharmaceutical Ingredient*. In software, **API** means *the set of commands one program offers to another*. In this document I write **"HTTP API"** for the software meaning and **"API (drug)"** for the pharmacy meaning.

---

## Contents

1. Functional and non-functional requirements
2. Ambiguities, conflicts and technical challenges
3. Proposed system architecture
4. Relational database schema
5. How the knowledge graph is stored and queried
6. Technology stack (with advantages and disadvantages)
7. Two-panel workspace and graph navigation
8. The hardest features and their dependencies
9. MVP milestones with testable acceptance criteria
10. Decisions needed from you
11. Glossary

---

## 1. Functional and non-functional requirements

All requirements below are **[Confirmed]** (taken from the spec). Nothing has been removed. The **Stage** column follows spec Section 18 ("MVP" = Stage 1). Where the spec gives no stage, I write *unstaged* and suggest one in Section 2.

### 1.1 Functional requirements (what the system must *do*)

#### A. Entities (scientific concepts)

| ID | Requirement | Stage |
|---|---|---|
| FR-E1 | Create, edit and "delete" entities (delete = archive) | MVP |
| FR-E2 | Every entity has a stable unique ID; names are never used as IDs | MVP |
| FR-E3 | Name plus multiple alternative names and synonyms | MVP |
| FR-E4 | Entity type (drug, disease, pathogen, organ, protein, receptor, enzyme, pathway, dosage form, excipient, manufacturing process, analytical technique, clinical condition, and more); types are extensible | MVP |
| FR-E5 | Description and relevant metadata | MVP |
| FR-E6 | Creation date and last-modified date | MVP |
| FR-E7 | Verification status | MVP |
| FR-E8 | Revision history | MVP (see A7) |
| FR-E9 | An entity exists independently of how it is displayed | MVP |
| FR-E10 | One entity may appear in several categories without being duplicated | MVP |
| FR-E11 | Users can create new categories, scientific domains and "Niche / Non-lecture" tags; no restriction to predefined subjects | MVP basic / Stage 2 custom |
| FR-E12 | Distinguish API (drug), dosage form, formulation and marketed product as different things | MVP (as entity types) |

#### B. Knowledge entries (information about an entity)

| ID | Requirement | Stage |
|---|---|---|
| FR-K1 | One entity can have many independent knowledge entries | MVP |
| FR-K2 | Three kinds of entry: general scientific, lecture-specific, personal | MVP |
| FR-K3 | Entries never overwrite one another | MVP |
| FR-K4 | When adding information, the UI asks: General / Personal-or-lecture / Both | MVP |
| FR-K5 | "Both" keeps two distinct versions linked to the same concept | MVP |
| FR-K6 | Entries are organised by topic (mechanism, physicochemical properties, PK, metabolism, toxicity, …) | MVP |
| FR-K7 | Detail page sections: Overview, Chemical properties, Pharmacology, PK, Clinical applications, Adverse effects, Interactions, Dosage and formulations, Related concepts, Sources and revision history | MVP |

#### C. Relationships

| ID | Requirement | Stage |
|---|---|---|
| FR-R1 | A relationship connects a source entity to a target entity | MVP |
| FR-R2 | It has: ID, source, target, type, description/mechanism, context/conditions, evidence, verification status, revision history | MVP |
| FR-R3 | Default types: PART_OF, CAUSES, INHIBITS, ACTIVATES, TREATS, TARGETS, METABOLIZED_BY, CONTRAINDICATED_IN, ASSOCIATED_WITH, REGULATES, RESISTANCE_TO, USED_IN_FORMULATION; extensible | MVP |
| FR-R4 | Conditional, context-dependent claims (population, stage, circumstance); never assume universal truth | MVP |
| FR-R5 | Multiple relationships between the same two entities when type or context differs | MVP |
| FR-R6 | Relationships are cited, verified, updated, archived and reviewed independently of their entities | MVP |
| FR-R7 | Users can add custom (personal) relationships | MVP (personal scope) |

#### D. Sources, evidence, status and history

| ID | Requirement | Stage |
|---|---|---|
| FR-S1 | Source types: lecture slides, lecture documents, textbooks, research papers, clinical guidelines, official monographs, regulatory documents, other | MVP |
| FR-S2 | Source metadata: title, author/organisation, publication date, document type, edition/version, DOI/URL, jurisdiction, page/section, import date | MVP |
| FR-S3 | Sources support **individual claims or relationships**, not whole topics | MVP |
| FR-S4 | An evidence link records the claim, supports/contradicts, page or passage, evidence type, verification notes | MVP |
| FR-S5 | Multiple sources per claim | MVP |
| FR-S6 | Statuses: Proposed, Verified, Lecture-specific, Needs review, Outdated, Disputed, Archived | MVP |
| FR-S7 | AI-generated information starts as Proposed or Needs review and is **never** promoted automatically | MVP rule, used from Stage 3 |
| FR-S8 | Conflicts: notify the user, show claims side by side with dates/versions/jurisdictions/contexts, offer retain/update/archive/mark outdated; never silently overwrite; a newer date does not automatically replace an older guideline | Basic in MVP, full in Stage 2 |
| FR-S9 | Revision history: keep all versions, record who/what changed it, when and why; outdated versions stay accessible | Stage 2 in spec (I recommend MVP, see A7) |

#### E. Graph interface

| ID | Requirement | Stage |
|---|---|---|
| FR-G1 | Interactive graph: pan (drag background), zoom, select, move nodes, expand, collapse, navigate into a concept, filter relationships, show selected layers | MVP (layers Stage 2) |
| FR-G2 | Never display the whole database; show a focused subset and load more progressively | MVP |
| FR-G3 | Single click selects/inspects; double click expands; Alt+click opens as new focus; right click shows context actions; drag node moves it; drag background pans | MVP |
| FR-G4 | Keyboard shortcuts configurable where conflicts may occur | MVP basic |
| FR-G5 | Collapsible hierarchical sidebar next to the graph; hierarchy is navigation only, not a restriction on relationships | MVP |
| FR-G6 | Toggleable layers (Anatomy, Physiology, Pathophysiology, Diseases, Pharmacology, Clinical treatment, Medicinal chemistry, Microbiology, Lecture-specific, Personal notes) plus custom layers; layers are filters, not categories | Stage 2 |
| FR-G7 | Saved views (layer combinations and graph settings) with presets: Anatomy study, Disease study, Drug study, Clinical practice, Medicinal chemistry, Full overview; views do not duplicate knowledge | Stage 2 |
| FR-G8 | Anatomy navigation from whole body → systems → organs → tissues → mechanisms | MVP via hierarchy + PART_OF |

#### F. Two-panel workspace

| ID | Requirement | Stage |
|---|---|---|
| FR-W1 | **Maximum two** panels open at the same time | MVP |
| FR-W2 | Open a second panel, close either, resize, rearrange | MVP |
| FR-W3 | Each panel keeps its own focus, zoom and navigation history | MVP |
| FR-W4 | Both panels share one database | MVP |
| FR-W5 | Optional: open selected concept in the other panel; highlight shared concepts; compare molecules/info; graph in one panel and document/detail page in the other | MVP (open-in-other, graph+detail); rest later |
| FR-W6 | Usable on different screen sizes | MVP |

#### G. Molecular structures

| ID | Requirement | Stage |
|---|---|---|
| FR-M1 | Store SMILES: original, canonical, isomeric, formula, molecular weight, metadata, source, validation status | Stage 2 |
| FR-M2 | Canonicalise with a chemistry toolkit; always keep the original input | Stage 2 |
| FR-M3 | Generate 2D/3D views from chemical data; never store only images as the source of truth | Stage 4 |
| FR-M4 | Select atoms/bonds, identify functional groups, highlight regions, compare molecules, SAR annotations, explain modifications | Stage 4 |
| FR-M5 | Never show speculative structural interpretation as established SAR | Stage 4 rule |

#### H. Documents

| ID | Requirement | Stage |
|---|---|---|
| FR-D1 | Store original documents | Stage 2 |
| FR-D2 | Import PDF and DOCX (other formats later) | Stage 3 |
| FR-D3 | Thai, English and mixed Thai-English text | Stage 3 |
| FR-D4 | Text extraction with page and section identification | Stage 3 |
| FR-D5 | Document indexing and search inside documents | Stage 3 |

#### I. AI-assisted extraction

| ID | Requirement | Stage |
|---|---|---|
| FR-A1 | AI may identify concepts, relationships, definitions, categories, contradictions, and suggest additions | Stage 3 |
| FR-A2 | All AI output is a **proposal**; the user approves before it enters verified knowledge | Stage 3 |
| FR-A3 | Keep parsing, normalisation, language detection, indexing, extraction, source linking, retrieval/generation and human review as separate parts | Stage 3 |
| FR-A4 | Never assume AI extraction is correct, especially dosage, contraindications, structures, guidelines | Stage 3 rule |

#### J. Learning environment

| ID | Requirement | Stage |
|---|---|---|
| FR-L1 | Lecture-based mode (imported lecture material, professor's terminology) | Stage 3 |
| FR-L2 | Knowledge-graph mode (verified entries and their sources) | Stage 3 |
| FR-L3 | Question formats: multiple choice, short answer, long answer, mechanism, comparative, clinical case, application/reasoning | Stage 3 |
| FR-L4 | Long-answer evaluation: rubric, compare, correct/missing/incorrect points, model answer, links to sources, manual grade adjustment | Stage 3 |
| FR-L5 | Distinguish "scientifically correct" from "matches the lecture's expected terminology" | Stage 3 |
| FR-L6 | Learning history: attempts, correct/incorrect, repeated mistakes, weak concepts, topics reviewed, progress | Stage 3 |
| FR-L7 | Revision recommendations | Stage 5 |

#### K. Professor exam-pattern analysis (advanced)

| ID | Requirement | Stage |
|---|---|---|
| FR-X1 | Analyse past papers per professor: topic frequency, formats, difficulty, memorisation vs reasoning, mechanisms, cross-topic, wording, answer structures, marking | Stage 5 |
| FR-X2 | Generate practice exams from patterns + lecture material + verified knowledge | Stage 5 |
| FR-X3 | Show number of historical questions, supporting evidence, confidence and limitations; separate evidence from estimates | Stage 5 |
| FR-X4 | Never present practice questions as predictions; never claim to know a professor's intentions | Stage 5 rule |

#### L. Personal knowledge management

| ID | Requirement | Stage |
|---|---|---|
| FR-P1 | Personal notes, mnemonics, annotations | MVP (basic notes) |
| FR-P2 | Bookmarks, saved views, topic review status, knowledge inbox | *unstaged* (suggest Stage 2) |
| FR-P3 | Lifecycle: Inbox → Draft → Connected → Reviewed → Verified | *unstaged* (suggest Stage 2) |
| FR-P4 | Personal/speculative notes allowed without references | MVP |
| FR-P5 | Clinical and dosage claims clearly distinguished from verified information | MVP |
| FR-P6 | Personal notes never silently change general entries | MVP |

#### M. Clinical connections

| ID | Requirement | Stage |
|---|---|---|
| FR-C1 | Clinical reasoning pathway: patient context → disease → objective → drug selection → dose/regimen → monitoring → outcome | *unstaged* (suggest Stage 4) |
| FR-C2 | Connections: indications, contraindications, interactions, patient factors, dose adjustments, lab monitoring, response, adverse effects | MVP as relationship types |
| FR-C3 | Clinical and dosing info keeps its context: jurisdiction, population, guideline version, circumstances | MVP |
| FR-C4 | Dosage belongs to a drug/product/regimen context, not to a pathogen | MVP (data modelling rule) |
| FR-C5 | Educational reference tool, not an autonomous prescribing system | All stages |

#### N. Domain coverage

| ID | Requirement | Stage |
|---|---|---|
| FR-DOM1 | Pharmacology, Medicinal chemistry, Microbiology & infectious disease, Anatomy & physiology, Pharmaceutics, plus pharmaceutical analysis, clinical pharmacy, toxicology, pharmaceutical microbiology, biotechnology, regulatory affairs, law, R&D, pharmacoeconomics, public health | MVP (as data, no special code) |
| FR-DOM2 | Manufacturing-process explorer (e.g. wet granulation → equipment, parameters, CQAs, defects, troubleshooting) | Stage 4 |
| FR-DOM3 | Biological pathway exploration | Stage 4 |

#### O. Backup and portability

| ID | Requirement | Stage |
|---|---|---|
| FR-B1 | Manual backup at any time | MVP |
| FR-B2 | Restore from a previous backup without losing relationships or information | MVP |
| FR-B3 | Backup validation | MVP |
| FR-B4 | Monthly backup reminder | MVP (cheap) |
| FR-B5 | Automatic backup before major database changes | MVP (before migrations and restores) |
| FR-B6 | Automatic scheduled backups | Later ("eventually") |
| FR-B7 | Export the database, the original documents and assets | MVP (DB) / Stage 2 (documents) |
| FR-B8 | Move to another computer without losing relationships or source links | MVP |

### 1.2 Non-functional requirements (how well the system must work)

| ID | Requirement |
|---|---|
| NFR-1 Local-first | Data, documents and images stored locally; core browsing and editing work offline. |
| NFR-2 AI optional | AI may need the internet; the MVP must not depend on any online AI service. |
| NFR-3 Data integrity | Never silently discard or overwrite knowledge; preserve history; protect data during updates. |
| NFR-4 Scientific separation | Always keep apart: established science / lecture teaching / personal belief / AI proposal / uncertain or disputed. |
| NFR-5 Portability | Database and files transferable; no lock-in. |
| NFR-6 Performance | Load neighbourhoods on demand, limit initial connections, progressive expansion, optimised queries, responsive interaction, no unnecessary reloading. Test with realistic graph sizes before making performance claims. |
| NFR-7 Scalability | Designed to grow over many years; UI stays focused on the current task. |
| NFR-8 Modularity | The five components (Knowledge DB, Interface, Documents, AI/Learning, Personal Workspace) are logically separate; changing one does not mean rebuilding everything. |
| NFR-9 Extensibility | Entity types, relationship types, categories, layers and domains can be extended; future multi-user / PostgreSQL / cloud sync must not be made impossible. |
| NFR-10 Maintainability for a beginner | Explain decisions first, small testable milestones, no unnecessary abstraction, documented code and schema, consistent naming, version control, migrations, tests for critical database operations. |
| NFR-11 Language | Thai, English and mixed text. |
| NFR-12 Visual design | Research-workstation look: dark charcoal background, muted blue/violet/green accents, minimal, dense but uncluttered, clean typography, consistent hierarchy, no bright colours, decoration or unnecessary animation. |
| NFR-13 Technology choice | Judge technologies on beginner maintainability, local-first fit, offline use, performance, portability, licensing, long-term maintenance and integration complexity, not popularity. |
| NFR-14 Safety | Educational tool only; clinical information always shown with its context. |
| NFR-15 Process | Do not build advanced features before the foundation is reliable. Present plans for review first. |

---

## 2. Ambiguities, conflicts and technical challenges

Each item: **what the spec says → the problem → my recommendation.** Items marked **[Decision needed]** are also listed in Section 10.

### 2.1 Ambiguities and conflicts in the data model

**A1. "Lecture-specific" is both a *kind of entry* and a *status*.** [Decision needed]
Spec 3.2 makes lecture-specific a kind of knowledge entry. Spec 4.3 also lists "Lecture-specific" as a verification status. A lecture entry can itself be verified or disputed (e.g. the professor's slide contains an error), so one field cannot hold both facts.
→ **[Recommendation]** Use two separate fields. `scope` = general / lecture / personal (what *kind* of knowledge it is). `status` = proposed / verified / needs review / outdated / disputed (how *trustworthy* it is). I keep "lecture_specific" as an allowed status value so nothing is removed, but the UI would use `scope` for this.

**A2. "Archived" is both a status and an action.**
If archiving replaces the status, you lose what the status was before. Archiving a *verified* entry is different from archiving a *disputed* one.
→ **[Recommendation]** Archiving sets a separate `archived_at` date and `archive_reason`. The status stays unchanged. "Archived" still appears in the UI as a filter.

**A3. Two different lifecycles.**
Spec 4.3 has statuses (Proposed → Verified …). Spec 13 has a note lifecycle (Inbox → Draft → Connected → Reviewed → Verified). They overlap but are not the same.
→ **[Recommendation]** Statuses apply to scientific claims (entries and relationships). The Inbox lifecycle applies only to personal notes. Moving a note to "Verified" means *turning it into* a proper knowledge entry or relationship, which then gets its own status. The note keeps a link to what it became.

**A4. Personal KnowledgeEntry vs UserNote: two places for personal content.** [Decision needed]
Spec 3.2 has "Personal knowledge" entries (notes, mnemonics, unverified ideas). Spec 5 also has a separate UserNote table.
→ **[Recommendation]** Keep both, with clear roles:
- **Personal knowledge entry:** structured personal content *about one entity*, shown in that entity's sections. Example: a mnemonic for paracetamol toxicity.
- **User note:** free scratchpad and inbox. It can be attached to anything (entity, entry, relationship, source) or to nothing. Example: "Look up why NAPQI depletes glutathione".

**A5. Categories vs drug classes.** [Decision needed]
"Beta blockers" could be a *folder* in the sidebar or a *scientific concept* with its own mechanism and adverse effects. It is really both.
→ **[Recommendation]** Drug classes, pathogen families and organ systems become **entities**, linked by a new relationship type `MEMBER_OF` / `IS_A` ("Propranolol IS_A Beta blocker"). Categories stay a *navigation-only* tree (spec 7.2 already says this). Otherwise class-level knowledge has nowhere to live.

**A6. What exactly is a layer?** [Decision needed]
Spec 7.4 says layers are filters, not categories, but not *how* an item gets into a layer.
→ **[Recommendation]** Layers are mostly **rule-based**, e.g. "Pharmacology layer = relationship types TARGETS, INHIBITS, ACTIVATES, METABOLIZED_BY + entity types drug, receptor, enzyme". Manual inclusion is also possible. "Lecture-specific" and "Personal notes" layers are simple rules on `scope`. This is Stage 2.

**A7. Revision history is Stage 2, but "never overwrite" is a rule from day one.**
Without revisions, any edit in the MVP overwrites the previous text. That breaks spec 4.4, 4.5 and 20.3.
→ **[Recommendation]** Put **basic revision history in the MVP**: every change saves a full snapshot. Stage 2 adds the nicer UI (side-by-side compare, restore-a-version button).

**A8. What "Both" means.**
→ **[Recommendation]** Choosing "Both" creates **two** linked entries in one step: a general entry and a lecture entry (marked as counterparts of each other). Later editing one never changes the other. The UI can show them side by side.

**A9. Hard delete. [Confirmed: archive only.]**
Leftover question: what about a duplicate entity created by mistake (e.g. "Acetaminophen" created when "Paracetamol" already existed)?
→ **[Recommendation]** In the MVP: warn about possible duplicates when creating (matching names and aliases). Later (Stage 2): a **merge** feature that moves relationships and entries onto one entity and archives the other with a "merged into" pointer.

**A10. What does "verifying an entity" mean?**
Entity verification (spec 3.1) is different from claim verification. You verify that a concept *exists and is correctly identified*, while each *claim* about it is verified separately.
→ **[Recommendation]** Entities carry a status, but the real scientific checking happens on entries and relationships. On manual creation, the app asks you for the status. It does not assume "verified".

**A11. Source granularity.**
Evidence attaches to an entry or a relationship. One entry body may contain several claims (e.g. "Paracetamol inhibits COX centrally; half-life 2–3 h").
→ **[Recommendation]** Evidence links carry an optional `claim_text` and page locator, so one source can be tied to one sentence. If that is still too coarse, split the entry into smaller entries. No extra "claim" table for now.

**A12. Is the detail/inspector sidebar a "panel"?** [Decision needed]
The rule is a maximum of two panels. Do the hierarchy sidebar and the detail inspector count?
→ **[Recommendation]** No. "Panel" means a main workspace area (graph, detail page or document). The navigation sidebar and the small inspector are tools *inside* the workspace and do not count.

**A13. Dosage data structure.**
Dosage is high-risk and highly contextual (spec 6.3, 14).
→ **[Recommendation]** MVP: dosage is text in a "Dosage" section entry, always with structured **context** (jurisdiction, population, guideline version) and a source. Fully structured dosing (numbers, units, frequency, renal adjustment) is a later, separate design. The UI marks unverified dosage content clearly (FR-P5).

**A14. Conflict detection: who notices the conflict?**
Spec 4.4 says "when a newer source conflicts, notify the user". Detecting that two texts contradict each other automatically requires understanding them, i.e. AI.
→ **[Recommendation]** MVP: **manual**. When you attach evidence marked *contradicts*, the app offers to mark the claim *Disputed* and shows both sides. Stage 3: AI *suggests* possible conflicts, always as proposals.

**A15. Guidelines that replace older ones.**
"A newer date does not mean replacement" (spec 4.4).
→ **[Recommendation]** Sources have an explicit `supersedes_source_id` field. Replacement is only recorded when you set it.

**A16. Interface language.** [Decision needed]
The content is Thai and English, but the spec never says which language the *interface* (buttons, menus) uses.
→ **[Recommendation]** English interface for the MVP, with all texts kept in one file so Thai can be added later. Content can be in any language from the start.

**A17. Ordered processes and pathways.**
Wet granulation is a *sequence* of steps; a plain graph has no order.
→ **[Recommendation]** Stage 4 adds an optional `sequence_index` to relationships, or a `NEXT_STEP` relationship type. Not needed in the MVP, and easy to add later through a migration.

**A18. Unstaged features.**
Bookmarks, knowledge inbox, note lifecycle and topic review status have no stage in spec 18. The clinical reasoning pathway has none either.
→ **[Recommendation]** Bookmarks, inbox and lifecycle go to Stage 2. The clinical reasoning pathway goes to Stage 4.

### 2.2 Technical conflicts

**T1. PWA vs filesystem.** **Resolved [Confirmed]:** a local web server has full filesystem access, which backup and restore need.

**T2. Canonical SMILES differs between toolkits** (spec 9.1 already notes this).
→ Store `canonicalizer` (toolkit name and version) next to the canonical SMILES. Also store **InChIKey**, which is better for detecting duplicate molecules.

**T3. Monthly reminder / scheduled backup with a local server.** The server only runs while you use the app, so it cannot fire at "the 1st of the month".
→ Check at startup: "last backup was more than 30 days ago". A true background schedule only becomes possible with desktop packaging or a Windows scheduled task (later).

**T4. Backup while the app is writing.** Copying the database file while it is open can produce a broken copy.
→ Use SQLite's built-in **backup API**, which makes a consistent snapshot even while the app runs.

**T5. Thai search.** Thai is written without spaces between words, so normal full-text search tokenisers cannot find Thai words.
→ Use SQLite FTS5 with the **trigram** tokenizer, which matches any 3+ character substring in any language. A simple `LIKE` search covers queries shorter than 3 characters. Stage 3 document search can add proper Thai word segmentation (PyThaiNLP).

**T6. Many lecture slides are images inside PDFs.** Text extraction gets nothing from them; they need OCR (reading text from images), and Thai OCR is weaker than English OCR. This seriously affects Stage 3 and Stage 5.

**T7. Single click vs double click.** A double click always fires a single click first. That is fine here: "select, then expand" is natural, and nothing destructive happens on single click.

**T8. Alt+click.** Fine in browsers on Windows. On some Linux desktops Alt+drag moves windows. Shortcuts will be configurable (FR-G4).

**T9. Local server security.** The server will listen **only on `127.0.0.1`** (your own computer), so other devices on the Wi-Fi cannot reach your database. No login is needed for the MVP.

**T10. Licensing.** PyMuPDF (a strong PDF library) is AGPL-licensed. That is fine for private use, but it imposes obligations if PharmaGraph is ever distributed publicly (Stage 6). Permissively licensed alternatives exist (see Section 6).

**T11. Copyright of stored material.** Storing textbooks and slides is fine for personal study. Public or community access (Stage 6) would raise copyright issues for stored documents and quoted passages. The data model already keeps your own knowledge separate from source documents, which makes that future split possible.

---

## 3. Proposed system architecture

### 3.1 Big picture **[Recommendation]**

```
 ┌────────────────────────── Your computer ───────────────────────────┐
 │                                                                      │
 │   Browser (Chrome / Edge)                                            │
 │   ┌──────────────────────────────────────────────────────────────┐  │
 │   │  PharmaGraph web interface (React)                           │  │
 │   │  ┌─────────┐ ┌───────────────────┐ ┌───────────────────┐     │  │
 │   │  │ Sidebar │ │ Panel 1           │ │ Panel 2 (optional)│     │  │
 │   │  │ tree +  │ │ graph / detail /  │ │ graph / detail /  │     │  │
 │   │  │ search  │ │ document          │ │ document          │     │  │
 │   │  └─────────┘ └───────────────────┘ └───────────────────┘     │  │
 │   │        shared data cache (each item is fetched only once)    │  │
 │   └─────────────────────────────┬────────────────────────────────┘  │
 │                                 │ HTTP API (JSON), 127.0.0.1 only    │
 │   ┌─────────────────────────────┴────────────────────────────────┐  │
 │   │  PharmaGraph server (Python + FastAPI)                       │  │
 │   │   routes/      thin layer: receives requests, returns JSON   │  │
 │   │   services/    ALL the rules: revisions, archiving, status,  │  │
 │   │                "Both" pairs, AI-proposal rule, validation    │  │
 │   │   db/          SQL queries + numbered migration files        │  │
 │   │   backup/      backup, validate, restore                     │  │
 │   │   chemistry/   (Stage 2) RDKit: SMILES checks                │  │
 │   │   documents/   (Stage 2–3) file storage, text extraction     │  │
 │   │   ai/          (Stage 3) optional; may only create PROPOSALS │  │
 │   └─────────────────────────────┬────────────────────────────────┘  │
 │                                 │                                    │
 │   Data folder (this is what you back up and move between PCs)       │
 │     PharmaGraph-Data/                                                │
 │       pharmagraph.db      ← one SQLite file: all knowledge           │
 │       files/              ← original documents and images (Stage 2)  │
 │       backups/            ← backup .zip files                        │
 └──────────────────────────────────────────────────────────────────────┘
```

> **Plain terms.** The **server** is a Python program that runs quietly on your computer. It is the only thing that touches the database. The **interface** is a web page in your browser that asks the server for data ("give me Paracetamol's neighbours") and shows it. They talk over **HTTP**, the same way websites do, but everything stays on your machine, so it works offline.

### 3.2 How the spec's five components map onto this

| Spec component | Where it lives |
|---|---|
| Knowledge Database | `db/` + `services/knowledge…` + `pharmagraph.db` |
| Knowledge Interface | The React web interface |
| Document Management | `documents/` + the `files/` folder |
| AI and Learning System | `ai/` (Stage 3). It talks to the knowledge base only through `services/`, which forces everything it creates to be a proposal. |
| Personal Workspace | Notes/bookmarks/views tables + their services; panel layout stored in the browser |

### 3.3 Key architectural rules **[Recommendation]**

1. **One gatekeeper for writes.** Every change goes through `services/`. That single place enforces "save a revision", "archive instead of delete" and "AI output is a proposal". Routes and AI code never write SQL directly.
2. **The database also protects itself.** Even if code has a bug, database rules block the worst mistakes. Foreign keys prevent links to things that don't exist. Triggers prevent deleting knowledge or changing old revisions.
3. **Code and data live in different folders.** Updating the app never touches your data. The data folder path is a setting.
4. **Only relative file paths in the database** (e.g. `files/ab/abcd….pdf`, not `C:\Users\…`), so the data folder works on any computer.
5. **No internet needed** for the core. Fonts and libraries are bundled, not loaded from the web.
6. **One command starts everything.** In normal use the server also delivers the interface pages, so you run one program and open `http://127.0.0.1:8000`.
7. **Path to desktop later.** The same server can be wrapped in a desktop window (pywebview or Tauri) without rewriting it.

### 3.4 Proposed code folder layout **[Recommendation]**

```
pharmagraph/                 (git repository)
  README.md
  docs/                      this analysis, schema docs, decisions log
  server/
    app.py                   starts the server
    config.py                where the data folder is, etc.
    db/
      connection.py          opens SQLite with the right settings
      migrate.py             applies migrations in order
      migrations/
        001_initial.sql
        002_….sql
      queries/               SQL grouped by topic (entities.py, graph.py, …)
    services/                business rules (entities.py, entries.py, …)
    routes/                  HTTP API endpoints
    backup/
    tests/                   pytest tests (critical DB operations)
  web/                       React + TypeScript interface
    src/
      workspace/             two-panel layout
      graph/                 Cytoscape graph panel
      entity/                detail pages and forms
      sidebar/
      api/                   functions that call the server
```

---

## 4. Relational database schema

### 4.1 General conventions **[Recommendation]**

| Topic | Choice | Why (plain terms) |
|---|---|---|
| Database | SQLite 3 (version ≥ 3.38) | One file, no separate database program to install, very reliable, easy to copy. |
| IDs | `TEXT` UUID (version 7 if available, otherwise version 4), e.g. `0193f2c4-…` | A random-looking code that never changes and never clashes, even if two databases are merged later (future multi-user). Names can change; IDs never do. |
| Lookup codes | Short readable codes as IDs for small fixed lists (e.g. `TREATS`, `drug`, `verified`) | Easy to read in SQL. The human label is a separate, renamable column. |
| Dates | `TEXT` in ISO-8601 UTC, e.g. `2026-11-06T09:30:00Z` | SQLite has no date type. This format sorts correctly and is unambiguous. |
| Booleans | `INTEGER` 0/1 with a CHECK | SQLite has no boolean type. |
| Strict typing | `STRICT` tables | SQLite normally accepts wrong types silently; STRICT makes it refuse them. |
| Foreign keys | `PRAGMA foreign_keys = ON` on every connection | SQLite does not check foreign keys unless asked. |
| Archive | `archived_at` + `archive_reason` columns; DELETE blocked by triggers on knowledge tables | Implements "delete = archive" **[Confirmed]**. |
| Long text | Markdown in `TEXT` | Headings, lists, bold, simple tables, readable without the app. |
| Flexible extras | `metadata_json` (validated JSON) for type-specific details | Different entity types need different small details (e.g. ATC code for drugs). Important, queryable facts become real columns or relationships instead. |
| Naming | `snake_case`, singular table names, FK columns named `<table>_id` | Consistent and predictable. |

> **Plain terms.**
> - A **primary key (PK)** is the column that uniquely identifies a row (its ID).
> - A **foreign key (FK)** is a column that points to another table's PK, e.g. `knowledge_entry.entity_id → entity.id`. The database refuses a pointer to something that does not exist.
> - A **CHECK** is a rule the database enforces on every row, e.g. "scope must be general, lecture or personal".
> - A **trigger** is a small rule that runs automatically when something happens, e.g. "if anyone tries to DELETE an entity, refuse".
> - A **migration** is a numbered SQL file that changes the database structure. Applied in order, migrations take any old database to the newest structure without losing data.

### 4.2 Overview of tables

```
                 ┌──────────────┐        ┌──────────────┐
                 │ entity_type  │        │   category   │◄─┐ parent_id (tree)
                 └──────┬───────┘        └──────┬───────┘──┘
                        │1                      │
                        │                 entity_category (many-to-many)
                        ▼n                      │
 entity_alias ───n► ┌──────────┐ ◄──────────────┘
                    │  entity  │◄───────────────────────────┐
                    └──┬────┬──┘                            │ source / target
                       │1   │                        ┌──────┴────────┐
                       │    └────────────────────────│ relationship  │──► relationship_type
                       ▼n                            └──────┬────────┘
              ┌─────────────────┐                           │
 lecture ───► │ knowledge_entry │◄── counterpart (Both)     │
 professor    └───┬───────┬─────┘                           │
                  │       │                                 │
       ┌──────────┘       └─────────────┬───────────────────┘
       ▼                                ▼
  claim_context (conditions)      evidence_link ───► source ───► document (Stage 2)
  revision (history snapshots)    review (verification records)
  user_note (personal, attaches anywhere)

 Stage 2: layer, layer_rule, layer_entity, saved_view, bookmark, molecular_structure, document
 Stage 3: extracted_content, ai_run, quiz, question, question_entity, attempt
 Stage 5: exam_paper, exam_question
```

**"Attaches to one of several things".** Some tables (evidence, revisions, reviews, notes, contexts) can point to an entity *or* an entry *or* a relationship. **[Recommendation]** I give them one nullable FK column per possible target, plus a CHECK that exactly one is filled. The alternative ("target_type + target_id") is shorter but loses foreign-key protection. Integrity matters more here.

### 4.3 MVP tables (Stage 1): full definitions

These would form migration `001_initial.sql`. Comments (`--`) explain each column.

```sql
-- ================================================================
-- 0. Housekeeping
-- ================================================================

-- Which migrations have been applied (managed by migrate.py).
CREATE TABLE schema_migration (
  version     INTEGER PRIMARY KEY,        -- 1, 2, 3 …
  filename    TEXT    NOT NULL,           -- '001_initial.sql'
  checksum    TEXT    NOT NULL,           -- detects edited-after-apply files
  applied_at  TEXT    NOT NULL
) STRICT;

-- Small key/value facts about this database.
-- e.g. database_id (identifies this knowledge base on any computer), created_at.
CREATE TABLE app_meta (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
) STRICT;

-- ================================================================
-- 1. Lookup (reference) tables, all extensible by the user
-- ================================================================

CREATE TABLE verification_status (
  code         TEXT PRIMARY KEY,   -- proposed | verified | lecture_specific | needs_review | outdated | disputed
  label        TEXT NOT NULL,
  description  TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0
) STRICT;
-- Note: 'archived' is NOT a status; see archived_at columns (decision A2).

CREATE TABLE entity_type (
  id           TEXT PRIMARY KEY,   -- drug, drug_class, disease, pathogen, organ, tissue, protein,
                                   -- receptor, enzyme, pathway, api_substance, dosage_form,
                                   -- formulation, medicinal_product, regimen, excipient,
                                   -- manufacturing_process, equipment, analytical_technique,
                                   -- clinical_condition, population, concept, other …
  label        TEXT NOT NULL,
  description  TEXT,
  is_builtin   INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0,1)),
  archived_at  TEXT
) STRICT;

CREATE TABLE relationship_type (
  id             TEXT PRIMARY KEY,  -- TREATS, INHIBITS, … plus IS_A / MEMBER_OF (decision A5),
                                    -- CONTAINS (product→API), HAS_DOSAGE_FORM, INTERACTS_WITH,
                                    -- MONITORED_BY, ADVERSE_EFFECT_OF … (extensible)
  label          TEXT NOT NULL,     -- 'treats'
  inverse_label  TEXT,              -- 'treated by' (shown when viewing from the target)
  description    TEXT,
  is_directed    INTEGER NOT NULL DEFAULT 1 CHECK (is_directed IN (0,1)),  -- ASSOCIATED_WITH = 0
  is_builtin     INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0,1)),
  archived_at    TEXT
) STRICT;

-- Topic sections for knowledge entries and detail pages (spec 3.2, 15.2).
CREATE TABLE knowledge_section (
  id           TEXT PRIMARY KEY,   -- overview, chemistry, mechanism, pharmacodynamics,
                                   -- pharmacokinetics, metabolism, toxicity, adverse_effects,
                                   -- interactions, indications, contraindications, dosage,
                                   -- formulation, monitoring, mnemonic, other …
  label        TEXT NOT NULL,
  description  TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  archived_at  TEXT
) STRICT;

-- Which sections a detail page shows for each entity type, and in what order.
CREATE TABLE entity_type_section (
  entity_type_id  TEXT NOT NULL REFERENCES entity_type(id),
  section_id      TEXT NOT NULL REFERENCES knowledge_section(id),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (entity_type_id, section_id)
) STRICT;

-- Kinds of condition a claim can depend on (spec 3.4, 14).
CREATE TABLE context_kind (
  id           TEXT PRIMARY KEY,   -- population, age_group, disease_stage, jurisdiction, route,
                                   -- guideline_version, renal_function, hepatic_function,
                                   -- pregnancy_lactation, dose_range, clinical_setting, other
  label        TEXT NOT NULL,
  description  TEXT
) STRICT;

-- ================================================================
-- 2. Entities
-- ================================================================

CREATE TABLE entity (
  id              TEXT PRIMARY KEY,                       -- UUID
  entity_type_id  TEXT NOT NULL REFERENCES entity_type(id),
  name            TEXT NOT NULL,                          -- preferred display name (NOT an identifier)
  description     TEXT,                                   -- short summary, 1–3 sentences
  metadata_json   TEXT CHECK (metadata_json IS NULL OR json_valid(metadata_json)),
  status_code     TEXT NOT NULL REFERENCES verification_status(code),
  version         INTEGER NOT NULL DEFAULT 1,             -- increases on every change
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  archived_at     TEXT,
  archive_reason  TEXT
) STRICT;
CREATE INDEX ix_entity_type ON entity(entity_type_id);
CREATE INDEX ix_entity_name ON entity(name COLLATE NOCASE);

CREATE TABLE entity_alias (
  id            TEXT PRIMARY KEY,
  entity_id     TEXT NOT NULL REFERENCES entity(id),
  alias         TEXT NOT NULL,                            -- 'Acetaminophen', 'APAP', 'พาราเซตามอล'
  alias_kind    TEXT NOT NULL DEFAULT 'synonym'
                CHECK (alias_kind IN ('synonym','abbreviation','brand_name','inn','usan',
                                      'chemical_name','local_name','misspelling','other')),
  language      TEXT,                                     -- 'en', 'th', 'la' …
  jurisdiction  TEXT,                                     -- e.g. 'US' for Acetaminophen
  created_at    TEXT NOT NULL,
  archived_at   TEXT,
  UNIQUE (entity_id, alias)
) STRICT;
CREATE INDEX ix_alias_text ON entity_alias(alias COLLATE NOCASE);

-- ================================================================
-- 3. Navigation hierarchy (spec 7.2): navigation only, never duplicates entities
-- ================================================================

CREATE TABLE category (
  id           TEXT PRIMARY KEY,
  parent_id    TEXT REFERENCES category(id),              -- NULL = top level
  name         TEXT NOT NULL,
  description  TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  archived_at  TEXT
) STRICT;
CREATE INDEX ix_category_parent ON category(parent_id);
-- The service layer refuses to set a parent that would create a loop (A inside B inside A).

CREATE TABLE entity_category (
  entity_id    TEXT NOT NULL REFERENCES entity(id),
  category_id  TEXT NOT NULL REFERENCES category(id),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (entity_id, category_id)
) STRICT;
CREATE INDEX ix_entity_category_cat ON entity_category(category_id);

-- ================================================================
-- 4. Lectures (needed to say WHICH lecture a lecture-specific entry comes from)
-- ================================================================

CREATE TABLE professor (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  department   TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL,
  archived_at  TEXT
) STRICT;

CREATE TABLE lecture (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  course_code    TEXT,
  course_name    TEXT,
  professor_id   TEXT REFERENCES professor(id),
  lecture_date   TEXT,                                    -- may be partial: '2026-08'
  academic_year  TEXT,
  notes          TEXT,
  created_at     TEXT NOT NULL,
  archived_at    TEXT
) STRICT;

-- ================================================================
-- 5. Knowledge entries (spec 3.2, 3.3)
-- ================================================================

CREATE TABLE knowledge_entry (
  id                    TEXT PRIMARY KEY,
  entity_id             TEXT NOT NULL REFERENCES entity(id),
  scope                 TEXT NOT NULL CHECK (scope IN ('general','lecture','personal')),
  section_id            TEXT NOT NULL REFERENCES knowledge_section(id),
  title                 TEXT,
  body                  TEXT NOT NULL,                    -- Markdown
  lecture_id            TEXT REFERENCES lecture(id),      -- which lecture (scope = 'lecture')
  counterpart_entry_id  TEXT REFERENCES knowledge_entry(id),  -- links the two halves of "Both"
  status_code           TEXT NOT NULL REFERENCES verification_status(code),
  origin                TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('user','ai','import')),
  version               INTEGER NOT NULL DEFAULT 1,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  archived_at           TEXT,
  archive_reason        TEXT,
  CHECK (scope = 'lecture' OR lecture_id IS NULL)          -- only lecture entries name a lecture
) STRICT;
CREATE INDEX ix_entry_entity ON knowledge_entry(entity_id, scope, section_id);
CREATE INDEX ix_entry_lecture ON knowledge_entry(lecture_id);

-- ================================================================
-- 6. Relationships (spec 3.4, 3.5)
-- ================================================================

CREATE TABLE relationship (
  id                    TEXT PRIMARY KEY,
  source_entity_id      TEXT NOT NULL REFERENCES entity(id),
  target_entity_id      TEXT NOT NULL REFERENCES entity(id),
  relationship_type_id  TEXT NOT NULL REFERENCES relationship_type(id),
  description           TEXT,                             -- mechanism / explanation (Markdown)
  scope                 TEXT NOT NULL DEFAULT 'general'
                        CHECK (scope IN ('general','lecture','personal')),  -- personal = custom link
  lecture_id            TEXT REFERENCES lecture(id),
  status_code           TEXT NOT NULL REFERENCES verification_status(code),
  origin                TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('user','ai','import')),
  version               INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  archived_at           TEXT,
  archive_reason        TEXT,
  CHECK (scope = 'lecture' OR lecture_id IS NULL)
  -- Deliberately NO unique constraint on (source, target, type):
  -- the same pair may be linked several times with different contexts (spec 5.1).
) STRICT;
CREATE INDEX ix_rel_source ON relationship(source_entity_id, relationship_type_id);
CREATE INDEX ix_rel_target ON relationship(target_entity_id, relationship_type_id);

-- Structured conditions on a claim: "TREATS … only in adults", "… per Thai FDA 2024".
CREATE TABLE claim_context (
  id                  TEXT PRIMARY KEY,
  knowledge_entry_id  TEXT REFERENCES knowledge_entry(id),
  relationship_id     TEXT REFERENCES relationship(id),
  context_kind_id     TEXT NOT NULL REFERENCES context_kind(id),
  value_text          TEXT,                               -- 'adults ≥ 18 y', 'TH', '2024 edition'
  value_entity_id     TEXT REFERENCES entity(id),         -- when the condition is itself an entity,
                                                          -- e.g. 'Pregnancy', 'CKD stage 4'
  created_at          TEXT NOT NULL,
  CHECK ((knowledge_entry_id IS NULL) <> (relationship_id IS NULL)),      -- exactly one target
  CHECK (value_text IS NOT NULL OR value_entity_id IS NOT NULL)
) STRICT;
CREATE INDEX ix_ctx_entry ON claim_context(knowledge_entry_id);
CREATE INDEX ix_ctx_rel   ON claim_context(relationship_id);

-- ================================================================
-- 7. Sources and evidence (spec 4.1, 4.2)
-- ================================================================

CREATE TABLE source (
  id                    TEXT PRIMARY KEY,
  source_type           TEXT NOT NULL
                        CHECK (source_type IN ('lecture_slides','lecture_document','textbook',
                               'research_paper','clinical_guideline','drug_monograph',
                               'regulatory_document','website','other')),
  title                 TEXT NOT NULL,
  authors               TEXT,                             -- free text: 'Smith J, Lee K'
  organization          TEXT,                             -- 'WHO', 'Thai FDA'
  publication_date      TEXT,                             -- may be partial: '2024' or '2024-03'
  edition               TEXT,
  version_label         TEXT,
  doi                   TEXT,
  url                   TEXT,
  isbn                  TEXT,
  jurisdiction          TEXT,                             -- 'TH', 'US', 'EU', 'international'
  language              TEXT,
  lecture_id            TEXT REFERENCES lecture(id),      -- when the source IS a lecture's slides
  supersedes_source_id  TEXT REFERENCES source(id),       -- explicit replacement only (A15)
  notes                 TEXT,
  imported_at           TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  archived_at           TEXT
  -- Stage 2 adds: document_id → document(id) (the stored original file)
) STRICT;
CREATE INDEX ix_source_doi ON source(doi);

CREATE TABLE evidence_link (
  id                  TEXT PRIMARY KEY,
  source_id           TEXT NOT NULL REFERENCES source(id),
  knowledge_entry_id  TEXT REFERENCES knowledge_entry(id),
  relationship_id     TEXT REFERENCES relationship(id),
  stance              TEXT NOT NULL DEFAULT 'supports'
                      CHECK (stance IN ('supports','contradicts','mentions')),
  evidence_type       TEXT NOT NULL DEFAULT 'other'
                      CHECK (evidence_type IN ('primary_research','systematic_review','review',
                             'guideline_recommendation','monograph_statement','textbook_statement',
                             'lecture_statement','expert_opinion','other')),
  claim_text          TEXT,                               -- which exact claim this supports (A11)
  locator             TEXT,                               -- 'p. 214', 'slide 12', 'Table 3'
  passage             TEXT,                               -- short relevant passage
  verification_notes  TEXT,
  created_at          TEXT NOT NULL,
  archived_at         TEXT,
  CHECK ((knowledge_entry_id IS NULL) <> (relationship_id IS NULL))
) STRICT;
CREATE INDEX ix_evidence_entry  ON evidence_link(knowledge_entry_id);
CREATE INDEX ix_evidence_rel    ON evidence_link(relationship_id);
CREATE INDEX ix_evidence_source ON evidence_link(source_id);

-- ================================================================
-- 8. History and verification (spec 4.5, ReviewHistory)
-- ================================================================

-- Every create/update/archive saves a FULL snapshot. Old versions are never lost.
CREATE TABLE revision (
  id                  TEXT PRIMARY KEY,
  entity_id           TEXT REFERENCES entity(id),
  knowledge_entry_id  TEXT REFERENCES knowledge_entry(id),
  relationship_id     TEXT REFERENCES relationship(id),
  version             INTEGER NOT NULL,                   -- matches the row's version after the change
  change_kind         TEXT NOT NULL
                      CHECK (change_kind IN ('create','update','status_change','archive','unarchive')),
  snapshot_json       TEXT NOT NULL CHECK (json_valid(snapshot_json)),  -- row + its aliases/contexts
  changed_by          TEXT NOT NULL CHECK (changed_by IN ('user','ai','import','system')),
  reason              TEXT,                               -- 'Updated per 2025 guideline'
  created_at          TEXT NOT NULL,
  CHECK ((entity_id IS NOT NULL) + (knowledge_entry_id IS NOT NULL) + (relationship_id IS NOT NULL) = 1)
) STRICT;
CREATE UNIQUE INDEX ux_rev_entity ON revision(entity_id, version)          WHERE entity_id IS NOT NULL;
CREATE UNIQUE INDEX ux_rev_entry  ON revision(knowledge_entry_id, version) WHERE knowledge_entry_id IS NOT NULL;
CREATE UNIQUE INDEX ux_rev_rel    ON revision(relationship_id, version)    WHERE relationship_id IS NOT NULL;

-- A human check, even when nothing changed ("re-checked against 2026 guideline: still valid").
CREATE TABLE review (
  id                  TEXT PRIMARY KEY,
  entity_id           TEXT REFERENCES entity(id),
  knowledge_entry_id  TEXT REFERENCES knowledge_entry(id),
  relationship_id     TEXT REFERENCES relationship(id),
  from_status_code    TEXT REFERENCES verification_status(code),
  to_status_code      TEXT NOT NULL REFERENCES verification_status(code),
  reviewed_by         TEXT NOT NULL DEFAULT 'user',       -- one user now; a user_id later
  notes               TEXT,
  created_at          TEXT NOT NULL,
  CHECK ((entity_id IS NOT NULL) + (knowledge_entry_id IS NOT NULL) + (relationship_id IS NOT NULL) = 1)
) STRICT;
CREATE INDEX ix_review_entry ON review(knowledge_entry_id);
CREATE INDEX ix_review_rel   ON review(relationship_id);

-- ================================================================
-- 9. Personal notes (spec 13; decision A3/A4)
-- ================================================================

CREATE TABLE user_note (
  id                  TEXT PRIMARY KEY,
  body                TEXT NOT NULL,                      -- Markdown
  entity_id           TEXT REFERENCES entity(id),
  knowledge_entry_id  TEXT REFERENCES knowledge_entry(id),
  relationship_id     TEXT REFERENCES relationship(id),
  source_id           TEXT REFERENCES source(id),
  stage               TEXT NOT NULL DEFAULT 'inbox'
                      CHECK (stage IN ('inbox','draft','connected','reviewed','verified')),
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  archived_at         TEXT,
  CHECK ((entity_id IS NOT NULL) + (knowledge_entry_id IS NOT NULL)
       + (relationship_id IS NOT NULL) + (source_id IS NOT NULL) <= 1)   -- attached to 0 or 1 thing
) STRICT;
CREATE INDEX ix_note_entity ON user_note(entity_id);

-- ================================================================
-- 10. Search index (spec: search; T5 Thai)
-- ================================================================

-- Rebuilt for an entity whenever its name, aliases or entries change.
CREATE VIRTUAL TABLE search_index USING fts5(
  entity_id UNINDEXED,      -- which entity a hit belongs to
  field     UNINDEXED,      -- 'name' | 'alias' | 'entry' | 'relationship'
  text,                     -- the searchable text
  tokenize = 'trigram'      -- matches any 3+ character substring, works for Thai
);

-- ================================================================
-- 11. Database-level safety nets
-- ================================================================

-- "Delete = archive" [Confirmed]: refuse real deletes on knowledge tables.
CREATE TRIGGER no_delete_entity BEFORE DELETE ON entity
BEGIN SELECT RAISE(ABORT, 'Entities are archived, never deleted'); END;
CREATE TRIGGER no_delete_entry BEFORE DELETE ON knowledge_entry
BEGIN SELECT RAISE(ABORT, 'Knowledge entries are archived, never deleted'); END;
CREATE TRIGGER no_delete_relationship BEFORE DELETE ON relationship
BEGIN SELECT RAISE(ABORT, 'Relationships are archived, never deleted'); END;
CREATE TRIGGER no_delete_source BEFORE DELETE ON source
BEGIN SELECT RAISE(ABORT, 'Sources are archived, never deleted'); END;
CREATE TRIGGER no_delete_evidence BEFORE DELETE ON evidence_link
BEGIN SELECT RAISE(ABORT, 'Evidence links are archived, never deleted'); END;

-- History is permanent: revisions and reviews can never be changed or removed.
CREATE TRIGGER revision_immutable_u BEFORE UPDATE ON revision
BEGIN SELECT RAISE(ABORT, 'Revisions are permanent'); END;
CREATE TRIGGER revision_immutable_d BEFORE DELETE ON revision
BEGIN SELECT RAISE(ABORT, 'Revisions are permanent'); END;
CREATE TRIGGER review_immutable_u BEFORE UPDATE ON review
BEGIN SELECT RAISE(ABORT, 'Reviews are permanent'); END;
CREATE TRIGGER review_immutable_d BEFORE DELETE ON review
BEGIN SELECT RAISE(ABORT, 'Reviews are permanent'); END;
```

#### Rules enforced in the service layer (not expressible as simple SQL)

| Rule | How |
|---|---|
| Every change writes a revision | The same transaction updates the row, increases `version` and inserts a `revision`. If either fails, neither happens. A test checks this for every update function. |
| Edits must have a reason (optional or required?) | The UI asks for a short reason. **[Recommendation]** Optional for typo fixes, required when status or meaning changes. |
| AI output is never verified automatically | Rows with `origin = 'ai'` can only be created as `proposed`/`needs_review`. Moving them to `verified` requires a `review` row made by the user. |
| "Both" | One transaction creates the general and lecture entries, each pointing to the other via `counterpart_entry_id`. |
| Duplicate warning | Before creating an entity, search names and aliases (case-insensitive) and show possible matches. |
| No category loops | Before changing `parent_id`, check that the new parent is not a descendant. |
| Contradicting evidence | Adding evidence with `stance = 'contradicts'` prompts: "Mark this claim as Disputed?" |

> **Plain terms: transaction.** A transaction is an all-or-nothing package of changes. If the computer crashes halfway, the database rolls back to exactly how it was before. A half-saved edit (new text but no revision) is therefore impossible.

### 4.4 Later-stage tables (designed now, created by later migrations)

Shown more briefly. They are designed now so the MVP does not block them. They will not be created until their stage.

```sql
-- ---------- Stage 2: layers, views, bookmarks ----------
CREATE TABLE layer (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT, description TEXT,
  is_builtin INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, archived_at TEXT
) STRICT;
CREATE TABLE layer_rule (                         -- rule-based membership (A6)
  id TEXT PRIMARY KEY, layer_id TEXT NOT NULL REFERENCES layer(id),
  rule_kind TEXT NOT NULL CHECK (rule_kind IN ('entity_type','relationship_type','scope','category','status')),
  rule_value TEXT NOT NULL                        -- e.g. 'TARGETS', 'lecture'
) STRICT;
CREATE TABLE layer_entity (                       -- manual membership
  layer_id TEXT NOT NULL REFERENCES layer(id), entity_id TEXT NOT NULL REFERENCES entity(id),
  PRIMARY KEY (layer_id, entity_id)
) STRICT;
CREATE TABLE saved_view (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
  view_json TEXT NOT NULL CHECK (json_valid(view_json)),  -- layers on/off, focus, filters, zoom
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT
) STRICT;
CREATE TABLE bookmark (
  id TEXT PRIMARY KEY, label TEXT,
  entity_id TEXT REFERENCES entity(id), saved_view_id TEXT REFERENCES saved_view(id),
  created_at TEXT NOT NULL,
  CHECK ((entity_id IS NULL) <> (saved_view_id IS NULL))
) STRICT;

-- ---------- Stage 2: molecules ----------
CREATE TABLE molecular_structure (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entity(id),
  is_primary INTEGER NOT NULL DEFAULT 1,           -- salts / stereoisomers may add more
  original_smiles TEXT NOT NULL,                   -- exactly as entered, never changed
  canonical_smiles TEXT,
  isomeric_smiles TEXT,
  canonicalizer TEXT,                              -- 'RDKit 2025.09.2' (T2)
  inchi TEXT, inchikey TEXT,                       -- InChIKey: good for duplicate detection
  molecular_formula TEXT, molecular_weight REAL,
  validation_status TEXT NOT NULL DEFAULT 'unchecked'
    CHECK (validation_status IN ('unchecked','valid','invalid','warning')),
  validation_message TEXT,
  source_id TEXT REFERENCES source(id),
  metadata_json TEXT CHECK (metadata_json IS NULL OR json_valid(metadata_json)),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT
) STRICT;
CREATE INDEX ix_mol_inchikey ON molecular_structure(inchikey);

-- ---------- Stage 2: stored documents ----------
CREATE TABLE document (
  id TEXT PRIMARY KEY,
  original_filename TEXT NOT NULL,
  stored_relpath TEXT NOT NULL UNIQUE,             -- 'files/3f/3fa9….pdf' (relative, rule 3.3-4)
  sha256 TEXT NOT NULL,                            -- detects corruption and duplicates
  mime_type TEXT, size_bytes INTEGER, page_count INTEGER, language TEXT,
  imported_at TEXT NOT NULL, archived_at TEXT
) STRICT;
-- plus: ALTER TABLE source ADD COLUMN document_id TEXT REFERENCES document(id);

-- ---------- Stage 3: extraction, AI, learning ----------
CREATE TABLE extracted_content (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES document(id),
  page_number INTEGER, section_label TEXT, ordinal INTEGER NOT NULL,
  text TEXT NOT NULL, language TEXT,
  extractor TEXT NOT NULL,                         -- 'pypdf 5.x', 'tesseract-tha 5.x'
  extracted_at TEXT NOT NULL
) STRICT;
CREATE TABLE ai_run (                              -- what model produced which proposals
  id TEXT PRIMARY KEY, purpose TEXT NOT NULL, provider TEXT, model TEXT, prompt_version TEXT,
  document_id TEXT REFERENCES document(id),
  started_at TEXT NOT NULL, finished_at TEXT, status TEXT, error TEXT
) STRICT;
-- plus: ai_run_id columns on knowledge_entry / relationship / evidence_link (nullable)

CREATE TABLE quiz (
  id TEXT PRIMARY KEY, title TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('lecture','knowledge_graph')),
  lecture_id TEXT REFERENCES lecture(id), created_by TEXT NOT NULL, created_at TEXT NOT NULL
) STRICT;
CREATE TABLE question (
  id TEXT PRIMARY KEY, quiz_id TEXT REFERENCES quiz(id),
  format TEXT NOT NULL CHECK (format IN ('multiple_choice','short_answer','long_answer',
         'mechanism','comparative','clinical_case','application')),
  prompt TEXT NOT NULL, options_json TEXT, expected_answer TEXT, rubric_json TEXT,
  difficulty INTEGER, created_by TEXT NOT NULL, created_at TEXT NOT NULL
) STRICT;
CREATE TABLE question_entity (                     -- which concepts a question tests (weak-topic tracking)
  question_id TEXT NOT NULL REFERENCES question(id), entity_id TEXT NOT NULL REFERENCES entity(id),
  PRIMARY KEY (question_id, entity_id)
) STRICT;
CREATE TABLE attempt (
  id TEXT PRIMARY KEY, question_id TEXT NOT NULL REFERENCES question(id),
  answer_text TEXT, ai_score REAL, manual_score REAL, max_score REAL,
  feedback_json TEXT,                              -- correct / missing / incorrect points, links
  attempted_at TEXT NOT NULL
) STRICT;
-- StudyProgress: computed as a VIEW over attempt + question_entity at first
-- (no separate table that could drift out of sync). A table only if it gets slow.

-- ---------- Stage 5: exam pattern analysis ----------
CREATE TABLE exam_paper (
  id TEXT PRIMARY KEY, professor_id TEXT REFERENCES professor(id), course_code TEXT,
  academic_year TEXT, exam_kind TEXT, document_id TEXT REFERENCES document(id), created_at TEXT NOT NULL
) STRICT;
CREATE TABLE exam_question (
  id TEXT PRIMARY KEY, exam_paper_id TEXT NOT NULL REFERENCES exam_paper(id),
  number TEXT, text TEXT NOT NULL, format TEXT, marks REAL, created_at TEXT NOT NULL
) STRICT;
-- plus an exam_question_entity link table, like question_entity.
```

### 4.5 Example: how real knowledge looks in these tables

> *Paracetamol*, with a general mechanism entry, a lecture version from Dr. A, one source, and a conditional relationship.

| Table | Row (simplified) |
|---|---|
| entity | `id=E1, type=drug, name='Paracetamol', status=verified` |
| entity_alias | `E1 → 'Acetaminophen' (usan, jurisdiction US)`, `E1 → 'พาราเซตามอล' (local_name, th)` |
| entity | `id=E2, type=enzyme, name='Cyclooxygenase (COX)'` |
| knowledge_entry | `K1: E1, scope=general, section=mechanism, body='Weak COX inhibitor, mainly central…', status=verified` |
| knowledge_entry | `K2: E1, scope=lecture, lecture=L1, section=mechanism, body='Dr. A: "acts centrally, minimal peripheral…"', counterpart=K1` |
| relationship | `R1: E1 —INHIBITS→ E2, description='Mainly in CNS; weak in peripheral tissue with high peroxide tone'` |
| claim_context | `R1: context_kind=clinical_setting, value_text='central nervous system'` |
| source | `S1: textbook, 'Goodman & Gilman's…', edition 14` |
| evidence_link | `S1 → R1, stance=supports, locator='p. 601'` |
| revision | `R1 v1 create (snapshot…)`; on later edit: `R1 v2 update, reason='clarified peripheral effect'` |

---

## 5. How the knowledge graph is represented and queried

### 5.1 Representation

> **Plain terms.** A graph is just **dots and lines**. Here every **entity** is a dot (node) and every **relationship** row is a line (edge) with a label like INHIBITS. A separate graph database is not needed: two tables (`entity`, `relationship`) plus two indexes are enough to answer "what is connected to X?" quickly. **[Confirmed]** spec 5.1 says a graph database is not mandatory for the MVP.

One helper **view** makes every relationship usable in both directions. Then "neighbours of X" is a single simple lookup, whether X is the source or the target.

```sql
-- A view is a saved query that behaves like a read-only table.
CREATE VIEW active_edge AS
  SELECT r.id AS relationship_id, r.source_entity_id AS from_id, r.target_entity_id AS to_id,
         r.relationship_type_id, r.scope, r.status_code, 'out' AS direction
  FROM relationship r WHERE r.archived_at IS NULL
  UNION ALL
  SELECT r.id, r.target_entity_id, r.source_entity_id,
         r.relationship_type_id, r.scope, r.status_code, 'in'
  FROM relationship r WHERE r.archived_at IS NULL;
```

`direction` tells the interface whether to show the label ("inhibits") or the inverse label ("inhibited by").

### 5.2 The queries the app needs

**(a) Neighbourhood of one entity.** This powers "focus" and "double-click to expand".

```sql
SELECT e.relationship_id, e.relationship_type_id, e.direction,
       n.id AS neighbor_id, n.name, n.entity_type_id, n.status_code
FROM active_edge e
JOIN entity n ON n.id = e.to_id AND n.archived_at IS NULL
WHERE e.from_id = :focus_id
  AND e.relationship_type_id IN (:allowed_types)     -- relationship filter (optional)
  AND e.scope IN (:allowed_scopes)                   -- e.g. hide personal/lecture
  AND e.to_id NOT IN (:already_on_screen)            -- only load what is new
ORDER BY (e.status_code = 'verified') DESC, n.name
LIMIT :limit;                                        -- e.g. 25: never the whole database (FR-G2)
```

**(b) How many connections a node has.** Used for a badge like "+38 more" so you know there is more to expand.

```sql
SELECT COUNT(*) FROM active_edge WHERE from_id = :id;
```

**(c) Multi-step neighbourhood (2–3 hops) and paths.** A **recursive query** walks outward step by step. Example: "How is Zidovudine connected to HIV?"

```sql
WITH RECURSIVE walk(entity_id, depth, path) AS (
  SELECT :start_id, 0, ',' || :start_id || ','
  UNION ALL
  SELECT e.to_id, w.depth + 1, w.path || e.to_id || ','
  FROM walk w
  JOIN active_edge e ON e.from_id = w.entity_id
  WHERE w.depth < 3                                    -- hard depth limit
    AND instr(w.path, ',' || e.to_id || ',') = 0       -- don't walk in circles
)
SELECT path, depth FROM walk WHERE entity_id = :goal_id ORDER BY depth LIMIT 1;
```

Depth is kept small (≤ 3–4) because the number of possible paths grows very fast. For deeper searches, the server can do a step-by-step search in Python using query (a) repeatedly.

**(d) Sidebar tree.** Children are loaded only when a folder is opened (lazy loading):

```sql
SELECT id, name FROM category WHERE parent_id = :id AND archived_at IS NULL ORDER BY sort_order, name;
SELECT en.id, en.name FROM entity_category ec JOIN entity en ON en.id = ec.entity_id
WHERE ec.category_id = :id AND en.archived_at IS NULL ORDER BY ec.sort_order, en.name;
```

Because `entity_category` is a link table, "Zidovudine" can sit under both *Antivirals* and *HIV* while existing only once.

**(e) Search.**

```sql
SELECT DISTINCT entity_id FROM search_index WHERE search_index MATCH :query LIMIT 30;
-- queries shorter than 3 characters fall back to: name/alias LIKE :query || '%'
```

**(f) Everything about one entity (detail page).** Several small queries: entity + aliases, entries grouped by section and scope, relationships (query a, without the limit, paginated), evidence per entry and relationship, notes.

### 5.3 HTTP API sketch (what the interface asks the server)

| Request | Purpose |
|---|---|
| `GET /api/entities/{id}` | Entity, aliases, entries, evidence, notes |
| `GET /api/entities/{id}/neighbors?types=&scopes=&exclude=&limit=25` | Graph expansion |
| `GET /api/search?q=` | Search |
| `GET /api/categories/{id}/children` | Sidebar |
| `POST /api/entities` · `PATCH /api/entities/{id}` · `POST /api/entities/{id}/archive` | Create, edit (with reason), archive |
| Same pattern for `/entries`, `/relationships`, `/sources`, `/evidence`, `/notes` | |
| `GET /api/{kind}/{id}/revisions` | History |
| `POST /api/backups` · `GET /api/backups` · `POST /api/backups/{name}/restore` | Backup and restore |

FastAPI generates an interactive page listing all of these at `/docs`, where you can try every request in the browser. This is very handy while learning.

### 5.4 Performance plan **[Recommendation]**

- Every graph lookup uses an index (`ix_rel_source`, `ix_rel_target`), so it reads only the matching rows, not the whole table.
- The interface never asks for more than one neighbourhood at a time and caches what it has already loaded.
- **Realistic test (spec 5.1):** milestone M13 generates a synthetic database (e.g. 50,000 entities and 300,000 relationships) and measures neighbourhood, search and detail-page times. Targets: under 100 ms for a neighbourhood and under 300 ms for search. These numbers are goals to measure, not promises. If something is slow, we fix that specific query.

---

## 6. Technology stack

Everything here is **[Recommendation]**, judged on the spec's own criteria (NFR-13). All are free and open source.

### 6.1 Core (MVP)

| Part | Choice | Advantages | Disadvantages / risks | Alternatives considered |
|---|---|---|---|---|
| Server language | **Python 3.12+** | Beginner-friendly and readable. It is the main language of science, so chemistry (RDKit), PDF/DOCX, Thai NLP and AI libraries are all available in the same language for later stages. | Slower than some languages (irrelevant at this scale). You need to install Python. | **Node.js/TypeScript**: one language for server and interface, but weak chemistry and Thai NLP tooling. |
| Web framework | **FastAPI** (MIT) | Small. Automatic `/docs` test page. Checks request data automatically (Pydantic). Very well documented. | Its "async" features can confuse beginners. We simply don't use them (plain functions work). | **Flask** (simpler but less built-in validation), **Django** (powerful but heavy for this). |
| Database | **SQLite** via Python's built-in `sqlite3` | Already included in Python. One portable file. Very reliable, widely used. FTS5 search and JSON built in. A long-term archival format. | One writer at a time (fine for one user). Moving to multi-user later means migrating to PostgreSQL (the schema is designed to make that straightforward). | **PostgreSQL** (needs a running server, overkill now), **Neo4j** (graph DB: extra system, weaker portability, not needed). |
| Data access | **Plain SQL** in small Python functions | You can read exactly what happens. No hidden magic. SQL knowledge transfers to PostgreSQL. | More typing than an ORM. | **SQLAlchemy ORM**: less SQL but a big extra concept to learn. |
| Migrations | **Numbered `.sql` files + a ~50-line runner** | Easy to understand ("run every file not yet applied, in order"). Backs up automatically before applying. | No automatic generation of migrations. | **Alembic**: standard tool, but adds complexity. |
| Interface | **React + TypeScript + Vite** | The most widely used UI library, so the most examples, tutorials and AI help. Components keep the two panels' states separate. TypeScript catches many mistakes before you run the code. | A learning curve (JSX, components, state). Needs a build step (Vite makes it fast). | **Svelte** (simpler syntax, smaller community) [Decision needed]; **plain JavaScript** (no build, but two independent panels get messy quickly). |
| Graph drawing | **Cytoscape.js** (MIT) | Built for biological networks. Has the events we need (tap, double tap, right click, drag), many layouts, add/remove nodes on the fly, style rules by type. Extensions for context menus. | Canvas drawing slows down above a few thousand visible elements (we deliberately show far fewer). | **Sigma.js** (huge graphs, fewer interaction features), **vis-network** (simple, less flexible), **D3** (total control, much more code), **React Flow** (good later for process diagrams). |
| Panel resizing | **react-resizable-panels** (MIT) | Small. Handles drag-to-resize, min sizes and keyboard access. | One more dependency. | Hand-written CSS split. |
| Server data cache | **TanStack Query** (MIT) | Each piece of data is fetched once and shared by both panels (spec: avoid repeated loading). Handles loading and error states. | Another concept to learn. | Hand-written cache. |
| Text format | **Markdown** (`react-markdown`) | Plain text that stays readable forever. Supports headings, lists, tables. | No rich formatting like colours (we don't want that anyway). | Rich-text editor (stores complex HTML). |
| Styling | **Plain CSS with CSS variables** for the dark theme | No framework to learn. The theme is defined in one place. | We write our own small components. | Tailwind, Mantine (could be added later). |
| Fonts | **Inter** + **Noto Sans Thai** (both OFL), bundled locally | Clean, readable, good Thai support, work offline. | — | — |
| Tests | **pytest** (server); later **Playwright** (clicking through the UI) | pytest is simple and standard. Critical DB rules get tests (NFR-10). | — | — |
| Version control | **git** (+ optional private GitHub repo) | Full history of the code; undo mistakes. | Learning git basics. | — |

### 6.2 Later stages

| Stage | Part | Choice | Notes |
|---|---|---|---|
| 2 | Chemistry | **RDKit** (Python, BSD) | The standard open toolkit: validates SMILES, canonical SMILES, formula, MW, InChIKey. |
| 4 | Molecule drawing | **RDKit.js** (WASM, BSD) or **SmilesDrawer** (MIT); **Ketcher** (Apache) for drawing/editing; **3Dmol.js** (BSD) for 3D | Atom/bond selection and substructure highlighting. Functional groups via SMARTS patterns. |
| 3 | PDF text | **pypdf / pdfplumber** (permissive) | **PyMuPDF** is better and faster but AGPL (T10). Fine for private use; decide before any public release. |
| 3 | DOCX text | **python-docx** (MIT) | |
| 3 | Thai text | **PyThaiNLP** (Apache) | Thai word segmentation for better search and extraction. |
| 3 | OCR | **Tesseract** with Thai + English (Apache) | Needed for image-only slides (T6). Thai accuracy varies. |
| 3 | AI | Thin, swappable module: **Claude API** (online) or a **local model** (e.g. via Ollama) | To be decided with the ICT collaborator (spec 10). The AI module only ever creates proposals. |
| 6 | Desktop app | **pywebview** (simplest with Python) or **Tauri** + Python "sidecar" | Wraps the same server; no rewrite. |
| 6 | Shared DB | **PostgreSQL** | UUID IDs and plain SQL make the move manageable. |

### 6.3 Backup and restore design (MVP)

- **Backup file** = one `.zip` in `backups/`, named like `pharmagraph-2026-11-06T0930Z-manual.zip`, containing:
  - `pharmagraph.db`: a consistent snapshot made with SQLite's backup API (T4)
  - `files/`: stored documents (from Stage 2)
  - `manifest.json`: backup format version, schema version, `database_id`, time, row counts per table, SHA-256 checksum of every file
- **Validation** (after every backup, and before every restore): open the copy and run `PRAGMA integrity_check` (should answer `ok`) and `PRAGMA foreign_key_check` (should find nothing). Then compare row counts and checksums with the manifest.
- **Restore:** validate the zip → **automatically back up the current state first** → copy into a temporary folder → apply migrations if the backup is from an older version → swap the folders in → reconnect. If anything fails, the current data stays untouched.
- **Automatic backups:** before every migration and before every restore (FR-B5).
- **Reminder:** at startup, if the newest backup is older than 30 days, show a banner (FR-B4, T3).
- **Moving computers:** copy the whole data folder, or install the app and restore a backup zip (FR-B8).

> **Plain terms: checksum.** A checksum (SHA-256) is a fingerprint of a file. If even one byte changes, the fingerprint changes completely, so we can prove a backup is not corrupted.

---

## 7. Two-panel workspace and graph navigation

### 7.1 Workspace state

The interface keeps one **workspace** object. The rule "at most two panels" **[Confirmed]** is built into its *type*, so code that tries to add a third panel does not even compile.

```ts
type Workspace = {
  panels: [PanelState] | [PanelState, PanelState];  // one or two, never three
  arrangement: 'side-by-side' | 'stacked';
  sizes: [number, number];                           // percentages, e.g. [60, 40]
  activePanelId: string;                             // where keyboard shortcuts apply
};

type PanelState = {
  id: string;
  view: GraphView | EntityView | DocumentView;       // what this panel shows
  history: { back: View[]; forward: View[] };        // independent Back/Forward per panel (FR-W3)
};

type GraphView = {
  kind: 'graph';
  focusEntityId: string;
  visibleNodeIds: string[];
  expandedFrom: Record<string, string>;  // nodeId → the node whose expansion added it (for collapse)
  pinned: Record<string, {x: number; y: number}>;  // nodes you dragged keep their place
  zoom: number; pan: {x: number; y: number};
  filters: { relationshipTypes?: string[]; scopes?: string[]; entityTypes?: string[] };
};
type EntityView   = { kind: 'entity'; entityId: string; section?: string };
type DocumentView = { kind: 'document'; documentId: string; page?: number };  // Stage 2–3
```

- **Shared data, separate views.** Both panels read from the same data cache (TanStack Query), which holds the same database facts. Each panel has its own `PanelState` (focus, zoom, history). When you edit an entity in one panel, the other panel updates automatically, because they share the cache.
- **Open / close:** "Open second panel" appears only when there is one panel. Closing either panel leaves the other. With one panel open, "Open in other panel" opens the second. With two open, it replaces the other panel's view (pushing the old view onto that panel's Back history, so nothing is lost).
- **Resize:** drag the divider (react-resizable-panels). Minimum width per panel, e.g. 320 px.
- **Rearrange:** a "swap" button exchanges the two panels; a toggle switches between side-by-side and stacked.
- **Different screen sizes (FR-W6):** wide screens (≥ 1200 px) default to side-by-side. Medium screens (800–1200 px) default to stacked. Narrow screens (< 800 px) show tabs: both panels stay open but only one is visible, with a one-click switch.
- **Highlight shared concepts (FR-W5):** nodes visible in both panels get a subtle outline. This is computed by comparing the two `visibleNodeIds` lists.
- **Remembering the layout:** the workspace is saved in the browser (localStorage) and restored next time. This is display state, not knowledge, so it does not go into the database (consistent with spec 7.5). Saved views (Stage 2) are the deliberate, named version.

### 7.2 Graph panel behaviour

Each graph panel has its own Cytoscape instance.

| You do | Cytoscape event | What happens |
|---|---|---|
| Single click node | `tap` | Select it; small inspector shows name, type, status, top facts |
| Double click node | `dbltap` | **Expand:** fetch up to 25 new neighbours (query 5.2a, excluding nodes already shown), place them around the node, mark `expandedFrom` |
| Double click an expanded node | `dbltap` | **Collapse:** remove the nodes it added (and, recursively, their own expansions), except pinned nodes, the focus, and nodes another expanded node also needs |
| Alt + click | `tap` with `altKey` | **New focus:** clear the canvas, load this node's neighbourhood, push the old view onto Back history |
| Right click | `cxttap` | Menu: Open details · Open in other panel · Expand by relationship type… · Add relationship from here · Add note · Archive… |
| Drag node | (built-in) | Moves it; position is pinned |
| Drag background / scroll | (built-in) | Pan / zoom |
| Click "+38 more" badge | custom | List of the remaining neighbours to pick from, or load the next 25 |

**Layout stability.** When nodes are added, only the *new* nodes are laid out (existing nodes stay where you put them), so the picture does not "jump". This is one of the trickier parts (Section 8).

**Safety cap.** If more than ~300 nodes are visible, the panel suggests collapsing or filtering. This keeps the app responsive (NFR-6).

**Visual encoding (spec 15).** Node colour by entity type (muted blue/violet/green palette on charcoal). Edge style by scope: solid = general, dashed = lecture, dotted = personal. Proposed/disputed items get a small marker. Archived items are never shown in the graph.

**Configurable shortcuts (FR-G4).** All bindings (Alt+click, keyboard keys) live in one settings list, so they can be changed if they clash with the browser or operating system.

**Sidebar + graph together.** Clicking an entity in the sidebar focuses it in the *active* panel. Right click in the sidebar offers "open in other panel".

---

## 8. The hardest features and their dependencies

Sorted from foundation to advanced. "Depends on" lists what must exist first.

| # | Feature | Why it is hard | Depends on | Stage |
|---|---|---|---|---|
| 1 | **Revision + archive integrity everywhere** | Every write path must save history correctly; one forgotten path silently loses data. | Service layer, transactions, tests | MVP: **everything else depends on this** |
| 2 | **Context-dependent claims** | Modelling "true only when…" without making data entry tedious. | Relationships, context kinds | MVP |
| 3 | **Incremental graph expand/collapse with stable layout** | Adding/removing nodes without the picture jumping; working out which nodes "belong" to which expansion. | Neighbourhood query, Cytoscape panel | MVP |
| 4 | **Two independent panels sharing data** | Keeping state separate while edits show up everywhere. | Graph panel built as a self-contained component | MVP |
| 5 | **Safe backup and restore** | DB and files must match; restore must never destroy current data if it fails. | Data folder layout, migrations | MVP |
| 6 | **Schema evolution over many years** | Old backups must still open in new versions. | Migration runner from day one | MVP → forever |
| 7 | **Thai search** | No spaces between Thai words. | FTS5 trigram (MVP), PyThaiNLP (Stage 3) | MVP basic |
| 8 | **Conflict handling (side-by-side, resolution)** | Automatic detection needs language understanding; the resolution UI must never lose either side. | Evidence, revisions, statuses; AI for auto-detection | MVP manual → Stage 2 UI → Stage 3 AI hints |
| 9 | **Entity merging (duplicates)** | Moving relationships/entries without breaking history or evidence. | Revisions, aliases | Stage 2 |
| 10 | **PDF/DOCX extraction with page mapping; OCR for image slides** | Slides are often images; Thai OCR is imperfect; layouts are messy. | Document storage | Stage 3 |
| 11 | **AI extraction + approval workflow** | Accuracy; linking each proposal to the exact page; reviewing many proposals efficiently. | 10, proposal statuses, source linking, ai_run | Stage 3 |
| 12 | **Long-answer grading** | Judging meaning, not keywords; separating "scientifically right" from "lecture's wording". | 11, verified knowledge with sources, rubrics | Stage 3 |
| 13 | **Interactive molecules + SAR** | Atom/bond selection, functional-group detection (SMARTS), tying SAR claims to a *part* of a molecule with evidence (needs a future `sar_annotation` table: substructure pattern + claim + evidence). | RDKit, SMILES storage, evidence model | Stage 4 |
| 14 | **Process and pathway explorers** | Needs ordered steps and branching (A17). | Relationship ordering extension | Stage 4 |
| 15 | **Structured clinical dosing / reasoning pathway** | High accuracy demands; many patient factors. | Context model, sources, regimen/product entities | Stage 4+ |
| 16 | **Exam-pattern analysis** | Few past papers means weak statistics; must show confidence and limitations honestly. | 10, 11, professor/lecture tables, question tagging | Stage 5 |
| 17 | **Multi-user / sync** | Conflicting edits, permissions. | UUIDs (already), PostgreSQL migration | Stage 6 |

```
Foundation (MVP):   1 revisions ─┬─ 2 contexts ─── 8 conflicts ─── 9 merge
                                 ├─ 6 migrations ─ 5 backup/restore
                                 └─ 3 graph ────── 4 two panels
Documents/AI:       10 extraction ─ 11 AI proposals ─ 12 grading ─ 16 exam analysis
Science views:      RDKit storage ─ 13 molecules/SAR;  ordering ─ 14 explorers;  2 ─ 15 dosing
```

---

## 9. MVP milestones with testable acceptance criteria

Each milestone is small, ends in something you can try, and is committed to git. "AC" = acceptance criteria, the checklist that proves the milestone is done. Most AC are also automated tests.

**Ordering principle:** server rules first, each with a minimal screen, so you can see progress early. **Backup comes before you start entering real knowledge.**

### M0 — Project setup
- Git repository, folder layout (3.4), Python environment, React app skeleton, dark theme colours and fonts.
- **AC:** one command starts the server; `http://127.0.0.1:8000` shows an empty PharmaGraph page; `/docs` lists the HTTP API; `pytest` runs (0 tests OK); the server is unreachable from another device.

### M1 — Database foundation
- Connection settings (foreign keys ON), migration runner, `001_initial.sql`, default lookup data (statuses, entity types, relationship types, sections, context kinds).
- **AC:** a new data folder gets a database automatically; running again changes nothing; `PRAGMA foreign_key_check` is clean; deleting an entity row in SQL is refused by the trigger (test); editing an applied migration file is detected (test).

### M2 — Entities, aliases and history
- Create, edit, archive, unarchive entities and aliases through the service layer, with a revision on every change. Simple forms in the UI.
- **AC:** create "Paracetamol" with alias "Acetaminophen"; edit its description → 2 revisions exist with the old text intact; archive → hidden from lists but viewable via "show archived" with its full history; unarchive works; creating "acetaminophen" again shows a duplicate warning; every update function has a test proving a revision is written.

### M3 — Knowledge entries and General / Lecture / Personal / Both
- Lectures and professors (minimal), entries by section and scope, the "Both" flow.
- **AC:** add a general mechanism entry and a separate lecture entry for the same entity; editing one never changes the other (test); choosing "Both" creates two linked entries in one step; each entry has its own revisions; a personal entry appears only under the personal label.

### M4 — Typed relationships with context
- Relationship types (incl. IS_A / MEMBER_OF), relationship create/edit/archive with revisions, claim contexts.
- **AC:** connect Paracetamol —INHIBITS→ COX; create two TREATS relationships between the same pair with different populations; both are stored and shown separately; viewing COX shows "inhibited by Paracetamol"; archiving a relationship leaves both entities untouched.

### M5 — Sources, evidence, statuses and reviews
- Source records, evidence links on specific entries/relationships, status changes with review records, contradicting evidence → offer "Disputed".
- **AC:** attach a textbook with "p. 601" to one relationship only (not the whole entity); one claim can have two sources; marking evidence "contradicts" offers Disputed status and records a review; a claim created with `origin = 'ai'` cannot be saved as verified without a user review (test).

### M6 — Search
- FTS5 trigram index over names, aliases and entries; quick search box.
- **AC:** find Paracetamol by "acetamino", by "APAP" (fallback for short queries) and by a Thai alias substring; archived entities are excluded by default; results in under 300 ms on the test data.

### M7 — Hierarchical sidebar
- Category tree, entity ↔ category links, lazy loading, create/rename/move/archive categories.
- **AC:** Zidovudine appears under both "Antivirals" and "HIV" while one entity exists (test checks a single row); moving a category under its own child is refused; collapsing/expanding works with the keyboard as well.

### M8 — Entity detail page
- Sections per entity type, scope labels, evidence shown under each claim, relationships list, revision history list.
- **AC:** the Paracetamol page shows Overview → … → Sources and revision history in the spec's order; general and lecture text are visually distinct; every claim shows its sources; history shows all versions with reasons.

### M9 — Backup and restore (before real data entry)
- Manual backup, validation, restore with automatic pre-restore backup, startup reminder, automatic backup before migrations.
- **AC:** round-trip test: create data → back up → change and archive things → restore → the database equals the backup exactly (row counts and contents) with all relationships and evidence intact; a deliberately corrupted zip is rejected and current data stays unchanged; the reminder appears when the newest backup is > 30 days old; a backup copied to another folder or PC restores correctly.

### M10 — Interactive graph (one panel)
- Neighbourhood API, Cytoscape panel, all interactions from 7.2, filters by relationship type and scope, "+N more" badges, Back/Forward.
- **AC:** focusing an entity with 200 relationships shows at most 25 neighbours plus a badge; double click expands, double click again collapses; drag node, pan and zoom work; Alt+click refocuses and Back returns to the previous view; right-click menu works; archived items never appear.

### M11 — Two-panel workspace
- Open/close/resize/swap/stack, independent state and history, "open in other panel", responsive behaviour, shared-concept highlighting.
- **AC:** HIV graph in panel 1 and Reverse transcriptase detail in panel 2; each keeps its own zoom and history; a third panel cannot be opened; editing in one panel updates the other; layout is restored after reload; usable at 1366×768 and on a narrow window (tabs).

### M12 — Personal notes
- Notes attached to anything or to nothing (inbox), simple list of inbox notes.
- **AC:** adding a note to the Paracetamol mechanism entry never changes that entry or its revisions (test); an unattached note appears in the inbox; notes are clearly labelled as personal everywhere.

### M13 — MVP acceptance pass and performance check
- Walk through all 12 criteria of spec Section 21; synthetic large database for performance measurement; write the user guide and schema documentation.
- **AC:** every item in spec 21 passes (checklist recorded in `docs/`); performance numbers measured and recorded on the synthetic database; backup/restore round trip passes on it as well.

**Spec Section 21 → milestone mapping:**

| Spec 21 criterion | Milestone |
|---|---|
| Create a scientific entity | M2 |
| Add general information | M3 |
| Add separate lecture-specific information | M3 |
| Connect two entities with a typed relationship | M4 |
| Attach a source to a specific claim or relationship | M5 |
| Search and retrieve an entity | M6 |
| Navigate the hierarchical sidebar | M7 |
| Explore relationships with the graph | M10 |
| Two independent panels, rearrangeable | M11 |
| Personal notes without overwriting | M12 |
| Export a backup | M9 |
| Restore without losing anything | M9 |

---

## 10. Decisions needed from you

Please answer these (a short "agree" is fine). My recommendation is listed first in each row.

| # | Question | My recommendation | Alternatives |
|---|---|---|---|
| D1 | How to represent "lecture-specific" (A1) | Separate `scope` field; status stays about trustworthiness | Keep as a status only |
| D2 | Archive as a flag that keeps the previous status (A2) | Yes | Archive replaces the status |
| D3 | Personal entries vs notes (A4) | Keep both, with the roles described | Merge into one |
| D4 | Drug classes / families as entities with IS_A (A5) | Yes; categories are navigation only | Classes only as categories |
| D5 | Layers rule-based plus manual (A6) | Yes (Stage 2) | Manual tagging only |
| D6 | Basic revision history in the MVP (A7) | Yes | Wait for Stage 2 as written |
| D7 | Inspector/sidebar not counted as "panels" (A12) | Yes | They count toward the two |
| D8 | Interface language (A16) | English UI first, ready for Thai | Thai UI / both from the start |
| D9 | Must a lecture-specific entry name its lecture? | Strongly encouraged, not forced | Forced (more data quality, more friction) |
| D10 | Default status when *you* create something manually | Ask each time, defaulting to "Proposed" | Default "Verified" |
| D11 | Reason for edits | Optional for small edits, required for status/meaning changes | Always required / never |
| D12 | Interface library (6.1) | React + TypeScript | Svelte / plain JS |
| D13 | Unstaged features (A18) | Bookmarks, inbox, lifecycle → Stage 2; clinical pathway → Stage 4 | Your preference |

Once you approve (or change) these, I will update this document to version 0.2 and start **M0** in small steps, explaining each one.

---

## 11. Glossary

| Term | Meaning |
|---|---|
| **Entity / node** | One scientific concept (a dot in the graph). |
| **Relationship / edge** | A typed link between two entities (a line in the graph). |
| **Scope** | General, lecture or personal: what *kind* of knowledge. |
| **Status** | Proposed, verified, disputed …: how *trustworthy* it is. |
| **Revision** | A saved snapshot of an item as it was at one moment. |
| **Migration** | A numbered file that upgrades the database structure safely. |
| **Primary key / foreign key** | A row's unique ID / a column pointing to another row's ID. |
| **Transaction** | An all-or-nothing group of database changes. |
| **Trigger** | A rule the database runs automatically (e.g. "refuse delete"). |
| **Index** | A lookup structure (like a book index) that makes searches fast. |
| **FTS5 / trigram** | SQLite's full-text search; trigram matches 3-letter pieces, so it works for Thai. |
| **Recursive query (CTE)** | A query that repeats itself step by step, used to walk the graph. |
| **UUID** | A long unique code used as an ID; never changes, never collides. |
| **HTTP API** | The set of requests the interface sends to the server. |
| **SMILES / InChIKey** | Text encodings of a molecule; InChIKey is a fixed-length fingerprint for matching. |
| **SMARTS** | A pattern language for finding substructures (e.g. functional groups) in molecules. |
| **OCR** | Reading text from images (e.g. scanned slides). |
| **localhost / 127.0.0.1** | "This computer". A server listening there is not reachable from other devices. |
