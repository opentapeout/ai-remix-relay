ALTER TABLE relays ADD COLUMN content_type TEXT NOT NULL DEFAULT 'image';

ALTER TABLE generations ADD COLUMN content_type TEXT NOT NULL DEFAULT 'image';

ALTER TABLE candidates ADD COLUMN content_type TEXT NOT NULL DEFAULT 'image';

ALTER TABLE nodes ADD COLUMN content_type TEXT NOT NULL DEFAULT 'image';
ALTER TABLE nodes ADD COLUMN mime_type TEXT NOT NULL DEFAULT 'image/webp';
ALTER TABLE nodes ADD COLUMN preview_text TEXT;

CREATE INDEX nodes_relay_type_created_idx ON nodes (relay_id, content_type, created_at);
