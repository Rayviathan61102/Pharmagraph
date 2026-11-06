-- PharmaGraph 002: default reference data. Users can add more later; built-ins are marked is_builtin = 1.

INSERT INTO verification_status (code, label, description, sort_order) VALUES
  ('proposed',         'Proposed',         'Entered but not yet checked against a source', 10),
  ('verified',         'Verified',         'Checked by you against reliable evidence',     20),
  ('lecture_specific', 'Lecture-specific', 'Kept for spec compatibility; prefer scope = lecture (decision D1)', 30),
  ('needs_review',     'Needs review',     'Should be re-checked',                          40),
  ('outdated',         'Outdated',         'Replaced by newer knowledge; kept for history', 50),
  ('disputed',         'Disputed',         'Sources disagree',                              60);

INSERT INTO entity_type (id, label, description, is_builtin) VALUES
  ('drug',                  'Drug / API',                'An active pharmaceutical ingredient, e.g. Paracetamol', 1),
  ('drug_class',            'Drug class',                'e.g. Beta blockers, NRTIs', 1),
  ('disease',               'Disease',                   NULL, 1),
  ('clinical_condition',    'Clinical condition',        'e.g. Pregnancy, Renal impairment', 1),
  ('pathogen',              'Pathogen',                  NULL, 1),
  ('organ_system',          'Organ system',              NULL, 1),
  ('organ',                 'Organ',                     NULL, 1),
  ('tissue',                'Tissue',                    NULL, 1),
  ('cell',                  'Cell',                      NULL, 1),
  ('protein',               'Protein',                   NULL, 1),
  ('receptor',              'Receptor',                  NULL, 1),
  ('enzyme',                'Enzyme',                    NULL, 1),
  ('pathway',               'Biological pathway',        NULL, 1),
  ('physiological_process', 'Physiological process',     NULL, 1),
  ('dosage_form',           'Dosage form',               'e.g. Tablet', 1),
  ('formulation',           'Formulation',               'A specific recipe: API plus excipients', 1),
  ('medicinal_product',     'Marketed medicinal product', NULL, 1),
  ('regimen',               'Treatment regimen',         NULL, 1),
  ('excipient',             'Excipient',                 NULL, 1),
  ('manufacturing_process', 'Manufacturing process',     'e.g. Wet granulation', 1),
  ('equipment',             'Equipment',                 NULL, 1),
  ('analytical_technique',  'Analytical technique',      NULL, 1),
  ('population',            'Patient population',        NULL, 1),
  ('concept',               'General concept',           NULL, 1),
  ('other',                 'Other',                     NULL, 1);

INSERT INTO relationship_type (id, label, inverse_label, description, is_directed, is_builtin) VALUES
  ('PART_OF',             'part of',              'has part',              'A component belongs to a larger structure', 1, 1),
  ('CAUSES',              'causes',               'caused by',             NULL, 1, 1),
  ('INHIBITS',            'inhibits',             'inhibited by',          NULL, 1, 1),
  ('ACTIVATES',           'activates',            'activated by',          NULL, 1, 1),
  ('TREATS',              'treats',               'treated by',            NULL, 1, 1),
  ('TARGETS',             'targets',              'targeted by',           'A drug acts on a biological target', 1, 1),
  ('METABOLIZED_BY',      'metabolized by',       'metabolizes',           NULL, 1, 1),
  ('CONTRAINDICATED_IN',  'contraindicated in',   'contraindication for',  NULL, 1, 1),
  ('ASSOCIATED_WITH',     'associated with',      'associated with',       NULL, 0, 1),
  ('REGULATES',           'regulates',            'regulated by',          NULL, 1, 1),
  ('RESISTANCE_TO',       'confers resistance to', 'resisted by',          'A mechanism contributes to resistance against an intervention', 1, 1),
  ('USED_IN_FORMULATION', 'used in formulation',  'formulation uses',      NULL, 1, 1),
  ('IS_A',                'is a',                 'includes',              'Membership of a class, e.g. Propranolol is a Beta blocker (decision D4)', 1, 1),
  ('CONTAINS',            'contains',             'contained in',          'e.g. a product contains an API', 1, 1),
  ('HAS_DOSAGE_FORM',     'has dosage form',      'dosage form of',        NULL, 1, 1),
  ('INTERACTS_WITH',      'interacts with',       'interacts with',        'Drug-drug interaction', 0, 1);

-- Ordered as in spec 15.2 (Overview, Chemical properties, Pharmacology, PK, Clinical, Adverse effects,
-- Interactions, Dosage and formulations); other domains' sections fit between.
INSERT INTO knowledge_section (id, label, sort_order) VALUES
  ('overview',           'Overview',                 10),
  ('chemistry',          'Chemical properties',      20),
  ('structure_function', 'Structure and function',   25),
  ('mechanism',          'Mechanism of action',      30),
  ('pharmacodynamics',   'Pharmacodynamics',         35),
  ('pharmacokinetics',   'Pharmacokinetics',         40),
  ('metabolism',         'Metabolism',               45),
  ('pathophysiology',    'Pathophysiology',          50),
  ('diagnosis',          'Diagnosis',                55),
  ('indications',        'Clinical applications',    60),
  ('treatment',          'Treatment',                65),
  ('adverse_effects',    'Adverse effects',          70),
  ('toxicity',           'Toxicity',                 75),
  ('contraindications',  'Contraindications',        80),
  ('interactions',       'Interactions',             85),
  ('dosage',             'Dosage',                   90),
  ('formulation',        'Formulations',             95),
  ('monitoring',         'Monitoring',              100),
  ('mnemonic',           'Mnemonics',               190),
  ('other',              'Other',                   200);

-- Sections always shown (even when empty) on the detail page of these types.
INSERT INTO entity_type_section (entity_type_id, section_id) VALUES
  ('drug', 'overview'), ('drug', 'chemistry'), ('drug', 'mechanism'), ('drug', 'pharmacokinetics'),
  ('drug', 'indications'), ('drug', 'adverse_effects'), ('drug', 'interactions'), ('drug', 'dosage'),
  ('drug_class', 'overview'), ('drug_class', 'mechanism'), ('drug_class', 'indications'),
  ('drug_class', 'adverse_effects'),
  ('disease', 'overview'), ('disease', 'pathophysiology'), ('disease', 'diagnosis'), ('disease', 'treatment'),
  ('pathogen', 'overview'), ('pathogen', 'structure_function'), ('pathogen', 'pathophysiology'),
  ('pathogen', 'treatment');

INSERT INTO context_kind (id, label, description) VALUES
  ('population',          'Population',            'e.g. adults, children, elderly'),
  ('age_group',           'Age group',             NULL),
  ('disease_stage',       'Disease stage',         NULL),
  ('jurisdiction',        'Jurisdiction',          'Country or region the claim applies to'),
  ('route',               'Route',                 'e.g. oral, IV'),
  ('guideline_version',   'Guideline version',     NULL),
  ('renal_function',      'Renal function',        NULL),
  ('hepatic_function',    'Hepatic function',      NULL),
  ('pregnancy_lactation', 'Pregnancy / lactation', NULL),
  ('dose_range',          'Dose range',            NULL),
  ('clinical_setting',    'Clinical setting',      NULL),
  ('other',               'Other condition',       NULL);
