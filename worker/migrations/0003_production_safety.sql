ALTER TABLE contributors ADD COLUMN owner_key TEXT;

UPDATE contributors
SET owner_key = CASE
  WHEN id = 'owner-bootstrap' THEN 'cs-gorkem-t'
  ELSE 'contributor-' || id
END
WHERE owner_key IS NULL OR owner_key = '';

CREATE UNIQUE INDEX contributors_owner_key_idx ON contributors(owner_key);

CREATE TABLE rate_limits (
  scope_key TEXT PRIMARY KEY,
  window_started_at TEXT NOT NULL,
  request_count INTEGER NOT NULL
);

CREATE INDEX rate_limits_window_idx ON rate_limits(window_started_at);
