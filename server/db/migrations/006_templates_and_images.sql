-- PharmaGraph 006: entity templates (an entity type's own ordered list of topics) and images.

-- Each template now has its own topic order.
ALTER TABLE entity_type_section ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
UPDATE entity_type_section SET sort_order = (SELECT sort_order FROM knowledge_section s WHERE s.id = section_id);

INSERT INTO knowledge_section (id, label, sort_order) VALUES
  ('image',                  'Image',                   5),
  ('definition',             'Definition',             12),
  ('classification',         'Classification',         14),
  ('composition',            'Composition',            16),
  ('biological_function',    'Biological function',    27),
  ('location',               'Location',               28),
  ('half_life',              'Half-life',              42),
  ('substrates',             'Substrates',             46),
  ('inhibitors',             'Inhibitors',             47),
  ('inducers',               'Inducers',               48),
  ('related_pathway',        'Related pathway',        49),
  ('etiology',               'Etiology',               49),
  ('clinical_manifestation', 'Clinical manifestation', 52),
  ('differential_diagnosis', 'Differential diagnosis', 57),
  ('efficacy',               'Efficacy',               62),
  ('complications',          'Complications',          78),
  ('caution',                'Caution',                82),
  ('manufacturing',          'Manufacturing',          96),
  ('evaluation',             'Evaluation',             97),
  ('stability',              'Stability',              98),
  ('packaging',              'Packaging',              99);

DELETE FROM entity_type_section WHERE entity_type_id IN ('drug', 'enzyme', 'disease', 'dosage_form');
INSERT INTO entity_type_section (entity_type_id, section_id, sort_order) VALUES
  ('drug', 'overview', 1), ('drug', 'chemistry', 2), ('drug', 'mechanism', 3), ('drug', 'pharmacokinetics', 4),
  ('drug', 'half_life', 5), ('drug', 'indications', 6), ('drug', 'efficacy', 7), ('drug', 'adverse_effects', 8),
  ('drug', 'contraindications', 9), ('drug', 'interactions', 10), ('drug', 'dosage', 11),

  ('enzyme', 'image', 1), ('enzyme', 'classification', 2), ('enzyme', 'biological_function', 3),
  ('enzyme', 'location', 4), ('enzyme', 'substrates', 5), ('enzyme', 'inhibitors', 6), ('enzyme', 'inducers', 7),
  ('enzyme', 'related_pathway', 8),

  ('disease', 'definition', 1), ('disease', 'etiology', 2), ('disease', 'pathophysiology', 3),
  ('disease', 'clinical_manifestation', 4), ('disease', 'diagnosis', 5), ('disease', 'differential_diagnosis', 6),
  ('disease', 'treatment', 7), ('disease', 'monitoring', 8), ('disease', 'caution', 9), ('disease', 'complications', 10),

  ('dosage_form', 'definition', 1), ('dosage_form', 'classification', 2), ('dosage_form', 'composition', 3),
  ('dosage_form', 'manufacturing', 4), ('dosage_form', 'evaluation', 5), ('dosage_form', 'stability', 6),
  ('dosage_form', 'packaging', 7);

-- Pictures live inside the database, so backups and moving to another computer include them automatically.
CREATE TABLE entity_image (
  id           TEXT PRIMARY KEY,
  entity_id    TEXT NOT NULL REFERENCES entity(id),
  media_type   TEXT NOT NULL CHECK (media_type IN ('image/png', 'image/jpeg', 'image/gif', 'image/webp')),
  data         BLOB NOT NULL,
  created_at   TEXT NOT NULL,
  archived_at  TEXT
) STRICT;
CREATE INDEX ix_image_entity ON entity_image(entity_id);
CREATE TRIGGER no_delete_image BEFORE DELETE ON entity_image
BEGIN SELECT RAISE(ABORT, 'Images are archived, never deleted'); END;
