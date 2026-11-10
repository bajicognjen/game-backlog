-- One synced plan per sync key. The key itself is never stored: key_hash is
-- its SHA-256 as hex. document holds the bytes the browser sent (the JSON
-- backup document, gzip-compressed by the browser; the Worker never reads
-- it). revision grows by one per write and refuses stale writes.
CREATE TABLE sync_documents (
  key_hash   TEXT PRIMARY KEY,
  revision   INTEGER NOT NULL,
  document   BLOB    NOT NULL,
  bytes      INTEGER NOT NULL,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
