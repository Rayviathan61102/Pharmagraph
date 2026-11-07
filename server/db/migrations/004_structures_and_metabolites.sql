-- PharmaGraph 004: chemical structures (SMILES), highlighted structural features, and metabolites.

-- A drawn structure of an entity. The SMILES text is never edited in place: to change it, add a new
-- structure and archive the old one, so highlights always refer to the exact molecule they were made on.
CREATE TABLE molecular_structure (
  id                 TEXT PRIMARY KEY,
  entity_id          TEXT NOT NULL REFERENCES entity(id),
  label              TEXT,                    -- e.g. 'free base', 'sodium salt'
  original_smiles    TEXT NOT NULL,           -- exactly as entered
  canonical_smiles   TEXT,
  canonicalizer      TEXT,                    -- toolkit + version that made canonical_smiles (analysis T2)
  molecular_formula  TEXT,
  molecular_weight   REAL,
  created_at         TEXT NOT NULL,
  archived_at        TEXT,
  archive_reason     TEXT
) STRICT;
CREATE INDEX ix_structure_entity ON molecular_structure(entity_id);

-- A highlighted part of a structure with its explanation, e.g. the 17-alpha ethynyl group of
-- ethinyl estradiol: "blocks metabolism, so it works orally".
-- atom_indices refer to atoms of the structure's original_smiles, in SMILES order (0 = first atom).
-- Editing makes a NEW row (replaces_id points to the old one) and archives the old one, so every
-- earlier wording is kept.
CREATE TABLE structure_annotation (
  id            TEXT PRIMARY KEY,
  structure_id  TEXT NOT NULL REFERENCES molecular_structure(id),
  atom_indices  TEXT NOT NULL CHECK (json_valid(atom_indices) AND json_type(atom_indices) = 'array'),
  note          TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT '#e0b050',
  status_code   TEXT NOT NULL DEFAULT 'proposed' REFERENCES verification_status(code),
  replaces_id   TEXT REFERENCES structure_annotation(id),
  created_at    TEXT NOT NULL,
  archived_at   TEXT,
  archive_reason TEXT
) STRICT;
CREATE INDEX ix_annotation_structure ON structure_annotation(structure_id);

CREATE TRIGGER no_delete_structure BEFORE DELETE ON molecular_structure
BEGIN SELECT RAISE(ABORT, 'Structures are archived, never deleted'); END;
CREATE TRIGGER no_delete_annotation BEFORE DELETE ON structure_annotation
BEGIN SELECT RAISE(ABORT, 'Structure notes are archived, never deleted'); END;

-- Metabolites are entities linked to their parent drug; activity, enzyme and pathway are conditions
-- on that link, so they get history, sources and graph display like every other relationship.
INSERT INTO entity_type (id, label, description, is_builtin) VALUES
  ('metabolite', 'Metabolite', 'A compound formed from a drug in the body, e.g. NAPQI', 1);

INSERT INTO entity_type_section (entity_type_id, section_id) VALUES
  ('metabolite', 'overview'), ('metabolite', 'chemistry'), ('metabolite', 'toxicity');

INSERT INTO relationship_type (id, label, inverse_label, description, is_directed, is_builtin) VALUES
  ('HAS_METABOLITE', 'has metabolite', 'metabolite of', 'A drug is converted into this metabolite', 1, 1);

INSERT INTO context_kind (id, label, description) VALUES
  ('metabolite_activity', 'Activity / toxicity', 'active, inactive, hepatotoxic, neurotoxic ...'),
  ('formed_by', 'Formed by', 'The enzyme (or other entity) that forms it'),
  ('metabolic_pathway', 'Pathway', 'e.g. glucuronidation, N-hydroxylation');
