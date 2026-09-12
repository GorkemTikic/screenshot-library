PRAGMA foreign_keys = ON;

CREATE TABLE workflow_requests (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('worker', 'sheet_import')),
  source_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  requester_hash TEXT,
  topic TEXT NOT NULL,
  requested_language TEXT NOT NULL,
  requested_platform TEXT NOT NULL,
  description TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  search_terms TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done', 'already_exists', 'cannot_be_done')),
  assignee_contributor_id TEXT REFERENCES contributors(id) ON DELETE SET NULL,
  resolution_note TEXT,
  linked_record_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by_contributor_id TEXT REFERENCES contributors(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('synced', 'pending')),
  UNIQUE(source, source_key)
);

CREATE TABLE request_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES workflow_requests(id) ON DELETE CASCADE,
  actor_contributor_id TEXT REFERENCES contributors(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  request_idempotency_key TEXT NOT NULL UNIQUE
);

CREATE TABLE request_operations (
  key TEXT PRIMARY KEY,
  actor_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'complete')),
  response_json TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX workflow_requests_status_idx ON workflow_requests(status, updated_at DESC);
CREATE INDEX workflow_requests_assignee_idx ON workflow_requests(assignee_contributor_id, updated_at DESC);
CREATE INDEX workflow_requests_sync_idx ON workflow_requests(sync_state);
CREATE INDEX request_events_request_idx ON request_events(request_id, created_at ASC);
