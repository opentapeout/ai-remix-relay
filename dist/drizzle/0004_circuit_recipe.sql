ALTER TABLE generations ADD COLUMN recipe_code TEXT;
ALTER TABLE generations ADD COLUMN circuit_input_commitment TEXT;

ALTER TABLE candidates ADD COLUMN recipe_code TEXT;
ALTER TABLE candidates ADD COLUMN circuit_input_commitment TEXT;

ALTER TABLE nodes ADD COLUMN recipe_code TEXT;
ALTER TABLE nodes ADD COLUMN circuit_input_commitment TEXT;
