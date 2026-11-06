-- PharmaGraph 001: the MVP schema (see docs/PharmaGraph-Analysis.md, section 4.3).
-- schema_migration is created by migrate.py itself, because it is needed before this file runs.

-- ================================================================
-- 0. Housekeeping
-- ================================================================

-- Small key/value facts about this database, e.g. database_id, created_at.
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
-- 'archived' is NOT a status; see the archived_at columns (decision D2).

CREATE TABLE entity_type (
  id           TEXT PRIMARY KEY,   -- drug, disease, enzyme ... (stable code; the label can be renamed)
  label        TEXT NOT NULL,
  description  TEXT,
  is_builtin   INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0,1)),
  archived_at  TEXT
) STRICT;

CREATE TABLE relationship_type (
  id             TEXT PRIMARY KEY,  -- TREATS, INHIBITS, IS_A ...
  label          TEXT NOT NULL,     -- 'treats'
  inverse_label  TEXT,              -- 'treated by' (shown when viewing from the target)
  description    TEXT,
  is_directed    INTEGER NOT NULL DEFAULT 1 CHECK (is_directed IN (0,1)),
  is_builtin     INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0,1)),
  archived_at    TEXT
) STRICT;

-- Topic sections for knowledge entries and detail pages (spec 3.2, 15.2).
CREATE TABLE knowledge_section (
  id           TEXT PRIMARY KEY,   -- overview, mechanism, pharmacokinetics ...
  label        TEXT NOT NULL,
  description  TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  archived_at  TEXT
) STRICT;

-- Which sections a detail page always shows for an entity type (even when still empty).
CREATE TABLE entity_type_section (
  entity_type_id  TEXT NOT NULL REFERENCES entity_type(id),
  section_id      TEXT NOT NULL REFERENCES knowledge_section(id),
  PRIMARY KEY (entity_type_id, section_id)
) STRICT;

-- Kinds of condition a claim can depend on (spec 3.4, 14).
CREATE TABLE context_kind (
  id           TEXT PRIMARY KEY,   -- population, jurisdiction, guideline_version ...
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
  description     TEXT,                                   -- short summary, 1-3 sentences
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
  language      TEXT,                                     -- 'en', 'th', 'la' ...
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

CREATE TABLE entity_category (
  entity_id    TEXT NOT NULL REFERENCES entity(id),
  category_id  TEXT NOT NULL REFERENCES category(id),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (entity_id, category_id)
) STRICT;
CREATE INDEX ix_entity_category_cat ON entity_category(category_id);

-- ================================================================
-- 4. Lectures (which lecture a lecture-specific entry comes from)
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
  lecture_id            TEXT REFERENCES lecture(id),
  counterpart_entry_id  TEXT REFERENCES knowledge_entry(id),  -- links the two halves of "Both"
  status_code           TEXT NOT NULL REFERENCES verification_status(code),
  origin                TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('user','ai','import')),
  version               INTEGER NOT NULL DEFAULT 1,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  archived_at           TEXT,
  archive_reason        TEXT,
  CHECK (scope = 'lecture' OR lecture_id IS NULL)
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
                        CHECK (scope IN ('general','lecture','personal')),
  lecture_id            TEXT REFERENCES lecture(id),
  status_code           TEXT NOT NULL REFERENCES verification_status(code),
  origin                TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('user','ai','import')),
  version               INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  archived_at           TEXT,
  archive_reason        TEXT,
  CHECK (scope = 'lecture' OR lecture_id IS NULL)
  -- No unique constraint on (source, target, type): the same pair may be linked
  -- several times with different contexts (spec 5.1).
) STRICT;
CREATE INDEX ix_rel_source ON relationship(source_entity_id, relationship_type_id);
CREATE INDEX ix_rel_target ON relationship(target_entity_id, relationship_type_id);

-- Structured conditions on a claim: "TREATS ... only in adults".
CREATE TABLE claim_context (
  id                  TEXT PRIMARY KEY,
  knowledge_entry_id  TEXT REFERENCES knowledge_entry(id),
  relationship_id     TEXT REFERENCES relationship(id),
  context_kind_id     TEXT NOT NULL REFERENCES context_kind(id),
  value_text          TEXT,
  value_entity_id     TEXT REFERENCES entity(id),
  created_at          TEXT NOT NULL,
  CHECK ((knowledge_entry_id IS NULL) <> (relationship_id IS NULL)),
  CHECK (value_text IS NOT NULL OR value_entity_id IS NOT NULL)
) STRICT;
CREATE INDEX ix_ctx_entry ON claim_context(knowledge_entry_id);
CREATE INDEX ix_ctx_rel   ON claim_context(relationship_id);

-- Every relationship usable in both directions, so "neighbours of X" is one lookup (analysis 5.1).
CREATE VIEW active_edge AS
  SELECT r.id AS relationship_id, r.source_entity_id AS from_id, r.target_entity_id AS to_id,
         r.relationship_type_id, r.scope, r.status_code, 'out' AS direction
  FROM relationship r WHERE r.archived_at IS NULL
  UNION ALL
  SELECT r.id, r.target_entity_id, r.source_entity_id,
         r.relationship_type_id, r.scope, r.status_code, 'in'
  FROM relationship r WHERE r.archived_at IS NULL;

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
  authors               TEXT,
  organization          TEXT,
  publication_date      TEXT,                             -- may be partial: '2024' or '2024-03'
  edition               TEXT,
  version_label         TEXT,
  doi                   TEXT,
  url                   TEXT,
  isbn                  TEXT,
  jurisdiction          TEXT,
  language              TEXT,
  lecture_id            TEXT REFERENCES lecture(id),
  supersedes_source_id  TEXT REFERENCES source(id),       -- explicit replacement only
  notes                 TEXT,
  imported_at           TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  archived_at           TEXT
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
  claim_text          TEXT,
  locator             TEXT,                               -- 'p. 214', 'slide 12'
  passage             TEXT,
  verification_notes  TEXT,
  created_at          TEXT NOT NULL,
  archived_at         TEXT,
  CHECK ((knowledge_entry_id IS NULL) <> (relationship_id IS NULL))
) STRICT;
CREATE INDEX ix_evidence_entry  ON evidence_link(knowledge_entry_id);
CREATE INDEX ix_evidence_rel    ON evidence_link(relationship_id);
CREATE INDEX ix_evidence_source ON evidence_link(source_id);

-- ================================================================
-- 8. History and verification
-- ================================================================

CREATE TABLE revision (
  id                  TEXT PRIMARY KEY,
  entity_id           TEXT REFERENCES entity(id),
  knowledge_entry_id  TEXT REFERENCES knowledge_entry(id),
  relationship_id     TEXT REFERENCES relationship(id),
  version             INTEGER NOT NULL,
  change_kind         TEXT NOT NULL
                      CHECK (change_kind IN ('create','update','status_change','archive','unarchive')),
  snapshot_json       TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  changed_by          TEXT NOT NULL CHECK (changed_by IN ('user','ai','import','system')),
  reason              TEXT,
  created_at          TEXT NOT NULL,
  CHECK ((entity_id IS NOT NULL) + (knowledge_entry_id IS NOT NULL) + (relationship_id IS NOT NULL) = 1)
) STRICT;
CREATE UNIQUE INDEX ux_rev_entity ON revision(entity_id, version)          WHERE entity_id IS NOT NULL;
CREATE UNIQUE INDEX ux_rev_entry  ON revision(knowledge_entry_id, version) WHERE knowledge_entry_id IS NOT NULL;
CREATE UNIQUE INDEX ux_rev_rel    ON revision(relationship_id, version)    WHERE relationship_id IS NOT NULL;

CREATE TABLE review (
  id                  TEXT PRIMARY KEY,
  entity_id           TEXT REFERENCES entity(id),
  knowledge_entry_id  TEXT REFERENCES knowledge_entry(id),
  relationship_id     TEXT REFERENCES relationship(id),
  from_status_code    TEXT REFERENCES verification_status(code),
  to_status_code      TEXT NOT NULL REFERENCES verification_status(code),
  reviewed_by         TEXT NOT NULL DEFAULT 'user',
  notes               TEXT,
  created_at          TEXT NOT NULL,
  CHECK ((entity_id IS NOT NULL) + (knowledge_entry_id IS NOT NULL) + (relationship_id IS NOT NULL) = 1)
) STRICT;
CREATE INDEX ix_review_entity ON review(entity_id);
CREATE INDEX ix_review_entry  ON review(knowledge_entry_id);
CREATE INDEX ix_review_rel    ON review(relationship_id);

-- ================================================================
-- 9. Personal notes (M12; created now so the schema matches the approved design)
-- ================================================================

CREATE TABLE user_note (
  id                  TEXT PRIMARY KEY,
  body                TEXT NOT NULL,
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
       + (relationship_id IS NOT NULL) + (source_id IS NOT NULL) <= 1)
) STRICT;
CREATE INDEX ix_note_entity ON user_note(entity_id);

-- ================================================================
-- 10. Search index (rebuilt for an entity whenever its name, aliases or entries change)
-- ================================================================

CREATE VIRTUAL TABLE search_index USING fts5(
  entity_id UNINDEXED,
  field     UNINDEXED,      -- 'name' | 'alias' | 'entry'
  text,
  tokenize = 'trigram'      -- matches any 3+ character piece of text, so it works for Thai
);

-- ================================================================
-- 11. Database-level safety nets
-- ================================================================

-- Delete means archive: refuse real deletes of knowledge.
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
CREATE TRIGGER no_delete_alias BEFORE DELETE ON entity_alias
BEGIN SELECT RAISE(ABORT, 'Aliases are archived, never deleted'); END;

-- History is permanent.
CREATE TRIGGER revision_immutable_u BEFORE UPDATE ON revision
BEGIN SELECT RAISE(ABORT, 'Revisions are permanent'); END;
CREATE TRIGGER revision_immutable_d BEFORE DELETE ON revision
BEGIN SELECT RAISE(ABORT, 'Revisions are permanent'); END;
CREATE TRIGGER review_immutable_u BEFORE UPDATE ON review
BEGIN SELECT RAISE(ABORT, 'Reviews are permanent'); END;
CREATE TRIGGER review_immutable_d BEFORE DELETE ON review
BEGIN SELECT RAISE(ABORT, 'Reviews are permanent'); END;
