CREATE TABLE shopify_tokens (
  id text PRIMARY KEY DEFAULT 'current',
  shop_domain text NOT NULL,
  access_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shopify_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to shopify_tokens"
  ON shopify_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);
