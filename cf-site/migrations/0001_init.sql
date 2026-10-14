CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wp_id INTEGER NOT NULL UNIQUE,
  type TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'publish',
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  title_en TEXT,
  excerpt_en TEXT,
  content_en TEXT,
  thumbnail TEXT,
  menu_order INTEGER NOT NULL DEFAULT 0,
  published_at TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  UNIQUE (type, slug)
);
CREATE INDEX idx_posts_type_pub ON posts(type, published_at DESC);

CREATE TABLE post_meta (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (post_id, key)
);

CREATE TABLE terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  taxonomy TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  UNIQUE (taxonomy, slug)
);

CREATE TABLE post_terms (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, term_id)
);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE views (post_id INTEGER PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE, count INTEGER NOT NULL DEFAULT 0);
