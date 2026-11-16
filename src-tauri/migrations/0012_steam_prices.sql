-- What Steam last charged for each wishlisted game, per store region: the
-- price as last loaded, when its current sale began, and the lowest price
-- seen so far. A cache rebuilt from Steam on every wishlist load, so it
-- stays out of backups; times are epoch milliseconds.
CREATE TABLE steam_prices (
  country TEXT NOT NULL,
  appid INTEGER NOT NULL,
  final_cents INTEGER NOT NULL,
  original_cents INTEGER NOT NULL,
  discount_pct INTEGER NOT NULL DEFAULT 0,
  discount_ends_at INTEGER,
  final_text TEXT NOT NULL,
  sale_since INTEGER,
  lowest_cents INTEGER NOT NULL,
  lowest_text TEXT NOT NULL,
  lowest_at INTEGER NOT NULL,
  loaded_at INTEGER NOT NULL,
  PRIMARY KEY (country, appid)
) WITHOUT ROWID;
