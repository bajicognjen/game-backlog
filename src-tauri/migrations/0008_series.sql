-- Series tag and order per game, for the out-of-order warning. Known titles
-- are backfilled; anything else is set in the edit dialog.
ALTER TABLE games ADD COLUMN series TEXT;
ALTER TABLE games ADD COLUMN series_order INTEGER;

UPDATE games SET series = 'GTA', series_order = 1 WHERE series IS NULL AND title = 'GTA 3';
UPDATE games SET series = 'GTA', series_order = 2 WHERE series IS NULL AND title = 'GTA Vice City';
UPDATE games SET series = 'GTA', series_order = 3 WHERE series IS NULL AND title = 'GTA San Andreas';
UPDATE games SET series = 'GTA', series_order = 4 WHERE series IS NULL AND title = 'GTA IV';
UPDATE games SET series = 'GTA', series_order = 5 WHERE series IS NULL AND title = 'GTA IV: Episodes from Liberty City';
UPDATE games SET series = 'Mafia', series_order = 1 WHERE series IS NULL AND title = 'Mafia: Definitive Edition';
UPDATE games SET series = 'Mafia', series_order = 2 WHERE series IS NULL AND title = 'Mafia II: Definitive Edition';
UPDATE games SET series = 'Mafia', series_order = 3 WHERE series IS NULL AND title = 'Mafia 3';
UPDATE games SET series = 'Tomb Raider', series_order = 1 WHERE series IS NULL AND title = 'Rise of the Tomb Raider';
UPDATE games SET series = 'Tomb Raider', series_order = 2 WHERE series IS NULL AND title = 'Shadow of the Tomb Raider DE';
UPDATE games SET series = 'Dying Light', series_order = 1 WHERE series IS NULL AND title = 'Dying Light Essentials';
UPDATE games SET series = 'Dying Light', series_order = 2 WHERE series IS NULL AND title = 'Dying Light 2: Stay Human Reloaded';
UPDATE games SET series = 'Ori', series_order = 1 WHERE series IS NULL AND title = 'Ori and the Blind Forest DE';
UPDATE games SET series = 'Ori', series_order = 2 WHERE series IS NULL AND title = 'Ori and the Will of the Wisps';
UPDATE games SET series = 'Far Cry', series_order = 1 WHERE series IS NULL AND title = 'Far Cry 4';
UPDATE games SET series = 'Far Cry', series_order = 2 WHERE series IS NULL AND title = 'Far Cry Primal';
UPDATE games SET series = 'Far Cry', series_order = 3 WHERE series IS NULL AND title = 'Far Cry 5';
UPDATE games SET series = 'Far Cry', series_order = 4 WHERE series IS NULL AND title = 'Far Cry New Dawn';
UPDATE games SET series = 'Far Cry', series_order = 5 WHERE series IS NULL AND title = 'Far Cry 6';
UPDATE games SET series = 'Spider-Man', series_order = 1 WHERE series IS NULL AND title = 'Marvel''s Spider-Man';
UPDATE games SET series = 'Spider-Man', series_order = 2 WHERE series IS NULL AND title = 'Marvel''s Spider-Man: Miles Morales';
UPDATE games SET series = 'Spider-Man', series_order = 3 WHERE series IS NULL AND title = 'Spider-Man 2';
UPDATE games SET series = 'Watch Dogs', series_order = 2 WHERE series IS NULL AND title = 'Watch Dogs 2';
UPDATE games SET series = 'GTA', series_order = 1 WHERE series IS NULL AND title = 'GTA III';
UPDATE games SET series = 'GTA', series_order = 6 WHERE series IS NULL AND title = 'GTA V';
UPDATE games SET series = 'GTA', series_order = 7 WHERE series IS NULL AND title = 'GTA VI';
