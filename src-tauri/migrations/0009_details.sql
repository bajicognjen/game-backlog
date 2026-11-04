-- Media, ratings, companies, store links and recommendations cached from
-- IGDB, as one JSON document per game (see src/domain/details.ts).
ALTER TABLE games ADD COLUMN details TEXT;
