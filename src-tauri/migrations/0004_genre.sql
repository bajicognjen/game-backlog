-- Optional genre per game. The list of codes lives in src/domain/types.ts
-- (no CHECK here, so new genres need no migration). Known seed titles are
-- backfilled so an existing database gets genres without retyping.
ALTER TABLE games ADD COLUMN genre TEXT;

UPDATE games SET genre = 'action_adventure' WHERE genre IS NULL AND title = 'Batman: Arkham Knight';
UPDATE games SET genre = 'horror' WHERE genre IS NULL AND title = 'Resident Evil 4 Remake';
UPDATE games SET genre = 'action_adventure' WHERE genre IS NULL AND title = 'Assassin''s Creed Shadows';
UPDATE games SET genre = 'narrative' WHERE genre IS NULL AND title = 'Detroit: Become Human';
UPDATE games SET genre = 'action_adventure' WHERE genre IS NULL AND title = 'GTA Vice City';
UPDATE games SET genre = 'survival' WHERE genre IS NULL AND title = 'The Forest';
UPDATE games SET genre = 'metroidvania' WHERE genre IS NULL AND title = 'Ori and the Will of the Wisps';
UPDATE games SET genre = 'rpg' WHERE genre IS NULL AND title = 'The Witcher 3';
UPDATE games SET genre = 'action_adventure' WHERE genre IS NULL AND title = 'Mafia: Definitive Edition';
UPDATE games SET genre = 'survival' WHERE genre IS NULL AND title = 'Dying Light Essentials';
UPDATE games SET genre = 'adventure' WHERE genre IS NULL AND title = 'Dave the Diver';
UPDATE games SET genre = 'action_adventure' WHERE genre IS NULL AND title = 'Watch Dogs 2';
UPDATE games SET genre = 'action_adventure' WHERE genre IS NULL AND title = 'Control';
UPDATE games SET genre = 'action_adventure' WHERE genre IS NULL AND title = 'Red Dead Redemption 2';
UPDATE games SET genre = 'action_adventure' WHERE genre IS NULL AND title = 'Mafia II: Definitive Edition';
UPDATE games SET genre = 'action_adventure' WHERE genre IS NULL AND title = 'GTA San Andreas';
UPDATE games SET genre = 'narrative' WHERE genre IS NULL AND title = 'Life is Strange';
UPDATE games SET genre = 'shooter' WHERE genre IS NULL AND title = 'Far Cry 6';
UPDATE games SET genre = 'action_adventure' WHERE genre IS NULL AND title = 'Mafia 3';
UPDATE games SET genre = 'action_adventure' WHERE genre IS NULL AND title = 'Rise of the Tomb Raider';
UPDATE games SET genre = 'action_adventure' WHERE genre IS NULL AND title = 'GTA IV';
UPDATE games SET genre = 'hack_and_slash' WHERE genre IS NULL AND title = 'Devil May Cry 5';
UPDATE games SET genre = 'rpg' WHERE genre IS NULL AND title = 'Cyberpunk 2077';
UPDATE games SET genre = 'action_adventure' WHERE genre IS NULL AND title = 'Shadow of the Tomb Raider DE';
UPDATE games SET genre = 'survival' WHERE genre IS NULL AND title = 'Dying Light 2: Stay Human Reloaded';
UPDATE games SET genre = 'action_adventure' WHERE genre IS NULL AND title = 'GTA IV: Episodes from Liberty City';
UPDATE games SET genre = 'rpg' WHERE genre IS NULL AND title = 'Skyrim';
UPDATE games SET genre = 'action_adventure' WHERE genre IS NULL AND title = 'Marvel''s Spider-Man';
UPDATE games SET genre = 'action_adventure' WHERE genre IS NULL AND title = 'Marvel''s Spider-Man: Miles Morales';
UPDATE games SET genre = 'shooter' WHERE genre IS NULL AND title = 'Far Cry 4';
UPDATE games SET genre = 'shooter' WHERE genre IS NULL AND title = 'Far Cry 5';
UPDATE games SET genre = 'shooter' WHERE genre IS NULL AND title = 'Far Cry New Dawn';
UPDATE games SET genre = 'shooter' WHERE genre IS NULL AND title = 'Far Cry Primal';
UPDATE games SET genre = 'action_adventure' WHERE genre IS NULL AND title = 'Spider-Man 2';
UPDATE games SET genre = 'action_adventure' WHERE genre IS NULL AND title = 'GTA 3';
UPDATE games SET genre = 'action_adventure' WHERE genre IS NULL AND title = 'God of War (2018)';
UPDATE games SET genre = 'metroidvania' WHERE genre IS NULL AND title = 'Ori and the Blind Forest DE';
