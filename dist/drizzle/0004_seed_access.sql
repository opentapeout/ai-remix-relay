ALTER TABLE relays ADD COLUMN access_mode TEXT NOT NULL DEFAULT 'public';
ALTER TABLE relays ADD COLUMN owner_wallet TEXT;
ALTER TABLE relays ADD COLUMN allowed_wallets TEXT NOT NULL DEFAULT '[]';

ALTER TABLE invites ADD COLUMN expires_at TEXT;
ALTER TABLE invites ADD COLUMN lock_first_wallet INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invites ADD COLUMN bound_wallet TEXT;

CREATE TABLE wallet_challenges (
  nonce TEXT PRIMARY KEY NOT NULL,
  wallet_address TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE wallet_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  wallet_address TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX wallet_sessions_expiry_idx ON wallet_sessions (expires_at);
