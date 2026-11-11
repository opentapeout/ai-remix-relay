ALTER TABLE nodes ADD COLUMN circuit_result TEXT;
ALTER TABLE nodes ADD COLUMN circuit_tx_hash TEXT;
ALTER TABLE nodes ADD COLUMN registry_tx_hash TEXT;

CREATE INDEX nodes_registry_tx_idx ON nodes (registry_tx_hash);
