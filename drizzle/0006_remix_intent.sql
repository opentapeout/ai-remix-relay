ALTER TABLE generations ADD COLUMN preserve_prompt TEXT NOT NULL DEFAULT '';
ALTER TABLE nodes ADD COLUMN preserve_prompt TEXT NOT NULL DEFAULT '';
