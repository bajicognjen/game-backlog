-- Each game belongs to a platform. PC keeps the scheduled plan; PS5 gets a
-- plain queue; PS4 only appears on finished games. Positions are unique per
-- platform from now on.
ALTER TABLE games ADD COLUMN platform TEXT NOT NULL DEFAULT 'pc' CHECK (platform IN ('pc', 'ps5', 'ps4'));

DROP INDEX games_position;
CREATE UNIQUE INDEX games_platform_position ON games(platform, position) WHERE position IS NOT NULL;
