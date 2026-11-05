-- The type column becomes the game's design (how its world is structured).
-- Rebuilding the table would cascade-delete play sessions through their
-- foreign key, so the column is swapped in place instead: add the new one,
-- copy the mapped values, drop the old one and take over its name.
-- Old size and mood labels map to the nearest design; the app can then
-- re-derive every design from IGDB.
ALTER TABLE games ADD COLUMN design TEXT NOT NULL DEFAULT 'linear'
  CHECK (design IN ('linear', 'semi_open', 'open_world', 'sandbox', 'metroidvania', 'roguelike'));

UPDATE games SET design = CASE type
  WHEN 'open_world' THEN 'open_world'
  WHEN 'giant' THEN 'open_world'
  WHEN 'medium' THEN 'semi_open'
  ELSE 'linear'
END;

ALTER TABLE games DROP COLUMN type;
ALTER TABLE games RENAME COLUMN design TO type;
