CREATE TABLE media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  alt TEXT NOT NULL DEFAULT '',
  uploaded_at TEXT NOT NULL,
  uploaded_by TEXT NOT NULL
);
CREATE INDEX idx_media_uploaded ON media(uploaded_at DESC, id DESC);
