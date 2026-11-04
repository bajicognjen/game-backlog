-- Add the 'paused' status. SQLite cannot change a CHECK constraint in place,
-- so the games table is rebuilt: copy, drop, rename, recreate indexes/trigger.
CREATE TABLE games_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT    NOT NULL,
  type            TEXT    NOT NULL CHECK (type IN ('linear', 'open_world', 'giant', 'relaxed', 'medium')),
  platform        TEXT    NOT NULL DEFAULT 'pc' CHECK (platform IN ('pc', 'ps5', 'ps4')),
  status          TEXT    NOT NULL CHECK (status IN ('in_progress', 'pending', 'paused', 'completed')),
  casual_hours    REAL    NOT NULL DEFAULT 0 CHECK (casual_hours >= 0),
  note            TEXT,
  position        INTEGER,            -- plan order within the platform; NULL once completed
  completed_order INTEGER,            -- finish order; NULL while planned
  completed_at    TEXT,               -- 'YYYY-MM-DD', optional
  rating          INTEGER CHECK (rating BETWEEN 1 AND 10),
  review          TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO games_new (id, title, type, platform, status, casual_hours, note, position, completed_order, completed_at, rating, review, created_at, updated_at)
  SELECT id, title, type, platform, status, casual_hours, note, position, completed_order, completed_at, rating, review, created_at, updated_at
  FROM games;

DROP TABLE games;
ALTER TABLE games_new RENAME TO games;

CREATE UNIQUE INDEX games_platform_position ON games(platform, position) WHERE position IS NOT NULL;
CREATE UNIQUE INDEX games_completed_order ON games(completed_order) WHERE completed_order IS NOT NULL;

CREATE TRIGGER games_touch_updated_at
AFTER UPDATE ON games
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE games SET updated_at = datetime('now') WHERE id = NEW.id;
END;
