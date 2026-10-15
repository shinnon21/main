CREATE TABLE contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'ja',
  ip_hash TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  notify_status TEXT NOT NULL DEFAULT 'pending',
  notify_error TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_contacts_created ON contacts(created_at DESC, id DESC);
