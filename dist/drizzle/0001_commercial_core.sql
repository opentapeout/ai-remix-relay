ALTER TABLE generations ADD COLUMN idempotency_key TEXT;
ALTER TABLE generations ADD COLUMN credit_entry_id TEXT;
ALTER TABLE generations ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE generations ADD COLUMN error_message TEXT;

ALTER TABLE candidates ADD COLUMN content_hash TEXT;

ALTER TABLE nodes ADD COLUMN candidate_id TEXT;
ALTER TABLE nodes ADD COLUMN license_code TEXT NOT NULL DEFAULT 'CC-BY-NC-4.0';
ALTER TABLE nodes ADD COLUMN split_bps INTEGER NOT NULL DEFAULT 0;
ALTER TABLE nodes ADD COLUMN rule_result TEXT;
ALTER TABLE nodes ADD COLUMN content_hash TEXT;

CREATE UNIQUE INDEX generations_user_idempotency_idx
  ON generations (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX nodes_candidate_idx
  ON nodes (candidate_id)
  WHERE candidate_id IS NOT NULL;

CREATE TABLE relays (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  seed_node_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE INDEX relays_owner_created_idx ON relays (owner_user_id, created_at);

CREATE TABLE invites (
  id TEXT PRIMARY KEY NOT NULL,
  token TEXT UNIQUE NOT NULL,
  relay_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  sender_user_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  recipient_hint TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  accepted_by_user_id TEXT,
  created_at TEXT NOT NULL,
  accepted_at TEXT
);

CREATE INDEX invites_sender_created_idx ON invites (sender_user_id, created_at);
CREATE INDEX invites_recipient_status_idx ON invites (accepted_by_user_id, status);

CREATE TABLE credit_accounts (
  user_id TEXT PRIMARY KEY NOT NULL,
  balance INTEGER NOT NULL DEFAULT 3,
  lifetime_granted INTEGER NOT NULL DEFAULT 3,
  lifetime_spent INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE credit_entries (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  kind TEXT NOT NULL,
  reference_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX credit_entries_user_created_idx ON credit_entries (user_id, created_at);
