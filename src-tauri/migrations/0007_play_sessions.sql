-- Hours played, one row per session. The plan projects from
-- casual_hours minus the sum of a game's sessions.
CREATE TABLE play_sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id    INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  played_on  TEXT    NOT NULL,               -- 'YYYY-MM-DD'
  hours      REAL    NOT NULL CHECK (hours > 0),
  note       TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX play_sessions_game ON play_sessions(game_id);
