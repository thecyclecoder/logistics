-- Replace boolean dismissed with a status field for better categorization
ALTER TABLE external_skus ADD COLUMN status text NOT NULL DEFAULT 'active';

-- Migrate existing data
UPDATE external_skus SET status = 'dismissed' WHERE dismissed = true;

-- Drop old column
ALTER TABLE external_skus DROP COLUMN dismissed;
