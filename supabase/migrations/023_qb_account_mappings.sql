-- QB Account Mappings: configurable IDs for customers, accounts used in month-end closing
CREATE TABLE IF NOT EXISTS qb_account_mappings (
  key TEXT PRIMARY KEY,
  qb_id TEXT NOT NULL,
  qb_name TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE qb_account_mappings ENABLE ROW LEVEL SECURITY;
