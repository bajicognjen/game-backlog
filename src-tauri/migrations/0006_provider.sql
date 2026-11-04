-- Metadata can now come from RAWG or IGDB: provider-neutral column names
-- plus a 'source' column saying where a row's metadata came from.
ALTER TABLE games RENAME COLUMN rawg_id TO external_id;
ALTER TABLE games RENAME COLUMN rawg_genres TO provider_genres;
ALTER TABLE games RENAME COLUMN rawg_tags TO provider_tags;
ALTER TABLE games ADD COLUMN source TEXT;

UPDATE games SET source = 'rawg' WHERE external_id IS NOT NULL;
