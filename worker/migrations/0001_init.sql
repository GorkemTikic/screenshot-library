PRAGMA foreign_keys = ON;

CREATE TABLE contributors (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'contributor')),
  code_hash TEXT NOT NULL,
  code_salt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  code_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  contributor_id TEXT NOT NULL REFERENCES contributors(id),
  action TEXT NOT NULL,
  record_id TEXT,
  commit_sha TEXT,
  changed_fields_json TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL,
  request_id TEXT NOT NULL UNIQUE
);

CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  contributor_id TEXT NOT NULL REFERENCES contributors(id),
  status TEXT NOT NULL CHECK (status IN ('processing', 'complete')),
  response_json TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX contributors_status_idx ON contributors(status);
CREATE INDEX sessions_contributor_idx ON sessions(contributor_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX audit_record_idx ON audit_events(record_id, created_at DESC);
CREATE INDEX audit_contributor_idx ON audit_events(contributor_id, created_at DESC);
