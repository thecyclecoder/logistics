-- Store all integration credentials in DB instead of env vars
CREATE TABLE integration_credentials (
  id text PRIMARY KEY,
  credentials jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to integration_credentials"
  ON integration_credentials FOR ALL TO service_role USING (true) WITH CHECK (true);
