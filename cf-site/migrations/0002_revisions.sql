CREATE TABLE revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  saved_at TEXT NOT NULL,
  saved_by TEXT NOT NULL,
  snapshot TEXT NOT NULL
);
CREATE INDEX idx_revisions_post ON revisions(post_id, id DESC);
