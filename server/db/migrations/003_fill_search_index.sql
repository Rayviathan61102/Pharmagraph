-- PharmaGraph 003: index everything that existed before search was added (M6).
-- From now on the app keeps the index up to date itself (services/search.py, same fields as below).
DELETE FROM search_index;
INSERT INTO search_index (entity_id, field, text) SELECT id, 'name', name FROM entity;
INSERT INTO search_index (entity_id, field, text)
  SELECT id, 'description', description FROM entity WHERE description IS NOT NULL;
INSERT INTO search_index (entity_id, field, text)
  SELECT entity_id, 'alias', alias FROM entity_alias WHERE archived_at IS NULL;
INSERT INTO search_index (entity_id, field, text)
  SELECT entity_id, 'entry', coalesce(title || char(10), '') || body FROM knowledge_entry WHERE archived_at IS NULL;
