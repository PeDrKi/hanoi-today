-- Cloudflare D1 (SQLite) schema. Apply with:  npx wrangler d1 execute hanoi-today --remote --file=schema.sql

-- End-to-end encrypted personal data (favourites, visited, hidden, history). The server never sees plain text.
CREATE TABLE IF NOT EXISTS sync (
  id         TEXT PRIMARY KEY,          -- SHA-256 of the user's secret code
  rev        INTEGER NOT NULL,          -- optimistic-concurrency counter
  data       TEXT NOT NULL,             -- AES-GCM blob, base64
  updated_at INTEGER NOT NULL           -- ms since epoch
);
CREATE INDEX IF NOT EXISTS sync_updated ON sync(updated_at);

-- Places shown by the app (edited from the Admin screen).
CREATE TABLE IF NOT EXISTS places (
  id         TEXT PRIMARY KEY,
  sort       INTEGER NOT NULL,
  json       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Reviews sent by users.
CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  json       TEXT NOT NULL
);

-- Who changed what in the Admin screen.
CREATE TABLE IF NOT EXISTS audit_log (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     INTEGER NOT NULL,
  actor  TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL
);

-- Per-visitor request counters (key = salted hash of the IP, never the IP itself).
CREATE TABLE IF NOT EXISTS rate (
  key TEXT PRIMARY KEY,
  win INTEGER NOT NULL,
  n   INTEGER NOT NULL
);

-- Photos uploaded from the Admin screen when no R2 bucket is bound (small, already compressed in the browser; base64 text).
CREATE TABLE IF NOT EXISTS images (
  id         TEXT PRIMARY KEY,          -- place id
  mime       TEXT NOT NULL,
  data       TEXT NOT NULL,             -- base64
  bytes      INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- One 1–5 star rating per anonymous device per place (a visitor can change it; no account, no personal data).
CREATE TABLE IF NOT EXISTS place_ratings (
  place_id   TEXT NOT NULL,
  device     TEXT NOT NULL,
  stars      INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (place_id, device)
);
CREATE INDEX IF NOT EXISTS idx_place_ratings_place ON place_ratings (place_id);
