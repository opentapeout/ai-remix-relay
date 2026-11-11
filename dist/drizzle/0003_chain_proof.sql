ALTER TABLE nodes ADD COLUMN circuit_result TEXT;
ALTER TABLE nodes ADD COLUMN circuit_tx_hash TEXT;
ALTER TABLE nodes ADD COLUMN registry_tx_hash TEXT;

CREATE INDEX nodes_registry_tx_idx ON nodes (registry_tx_hash);

ALTER TABLE generations ADD COLUMN recipe_code TEXT;
ALTER TABLE generations ADD COLUMN circuit_input_commitment TEXT;

ALTER TABLE candidates ADD COLUMN recipe_code TEXT;
ALTER TABLE candidates ADD COLUMN circuit_input_commitment TEXT;

ALTER TABLE nodes ADD COLUMN recipe_code TEXT;
ALTER TABLE nodes ADD COLUMN circuit_input_commitment TEXT;
