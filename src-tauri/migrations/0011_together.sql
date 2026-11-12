-- Games played with others (co-op with friends or a partner) get their own
-- list, the Together tab: no dates, and outside the singleplayer schedule.
-- A game keeps its platform; the flag decides which list it is planned in.
-- Positions are unique per list: the Together list spans platforms, every
-- other list is one platform's games that are not played together.
ALTER TABLE games ADD COLUMN together INTEGER NOT NULL DEFAULT 0 CHECK (together IN (0, 1));

DROP INDEX games_platform_position;
CREATE UNIQUE INDEX games_plan_position
  ON games(CASE WHEN together = 1 THEN 'together' ELSE platform END, position)
  WHERE position IS NOT NULL;
