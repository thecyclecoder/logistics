-- Store QB refresh tokens so they auto-rotate (QB issues new ones on each refresh)
CREATE TABLE qb_tokens (
  id text PRIMARY KEY DEFAULT 'current',
  refresh_token text NOT NULL,
  realm_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE qb_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to qb_tokens"
  ON qb_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);
