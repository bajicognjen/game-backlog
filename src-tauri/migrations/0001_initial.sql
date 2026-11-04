-- Key/value settings. Known keys: start_date (YYYY-MM-DD), hours_per_week,
-- theme (system | light | dark), seeded ('1' once the first-run seed ran).
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- One row per game, planned or completed. Enum values are English codes;
-- the Serbian labels live in the frontend (src/i18n/sr.ts).
CREATE TABLE games (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT    NOT NULL,
  type            TEXT    NOT NULL CHECK (type IN ('linear', 'open_world', 'giant', 'relaxed', 'medium')),
  status          TEXT    NOT NULL CHECK (status IN ('in_progress', 'pending', 'completed')),
  casual_hours    REAL    NOT NULL DEFAULT 0 CHECK (casual_hours >= 0),
  note            TEXT,
  position        INTEGER,            -- plan order; NULL once completed
  completed_order INTEGER,            -- finish order; NULL while planned
  completed_at    TEXT,               -- 'YYYY-MM-DD', optional
  rating          INTEGER CHECK (rating BETWEEN 1 AND 10),
  review          TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX games_position ON games(position) WHERE position IS NOT NULL;
CREATE UNIQUE INDEX games_completed_order ON games(completed_order) WHERE completed_order IS NOT NULL;

CREATE TRIGGER games_touch_updated_at
AFTER UPDATE ON games
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE games SET updated_at = datetime('now') WHERE id = NEW.id;
END;
