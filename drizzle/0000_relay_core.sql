CREATE TABLE generations (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  relay_id TEXT NOT NULL,
  parent_node_id TEXT NOT NULL,
  rule TEXT NOT NULL,
  prompt TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE candidates (
  id TEXT PRIMARY KEY NOT NULL,
  generation_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  asset_key TEXT NOT NULL,
  revised_prompt TEXT,
  selected INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX candidates_generation_idx ON candidates (generation_id);

CREATE TABLE nodes (
  id TEXT PRIMARY KEY NOT NULL,
  relay_id TEXT NOT NULL,
  parent_id TEXT,
  user_id TEXT NOT NULL,
  creator_name TEXT NOT NULL,
  title TEXT NOT NULL,
  rule TEXT NOT NULL,
  prompt TEXT NOT NULL,
  asset_key TEXT NOT NULL,
  receipt_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX nodes_relay_created_idx ON nodes (relay_id, created_at);
CREATE INDEX nodes_user_created_idx ON nodes (user_id, created_at);
