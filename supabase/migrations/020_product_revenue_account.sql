-- Revenue account mapping for journal entries
ALTER TABLE products ADD COLUMN revenue_account_id text;
ALTER TABLE products ADD COLUMN revenue_account_name text;
