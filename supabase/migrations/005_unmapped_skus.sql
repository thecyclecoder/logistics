-- Track SKUs seen during sync that couldn't be resolved to a product
CREATE TABLE unmapped_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL,
  source text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  dismissed boolean NOT NULL DEFAULT false,
  UNIQUE(external_id, source)
);

ALTER TABLE unmapped_skus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users have full access to unmapped_skus"
  ON unmapped_skus FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to unmapped_skus"
  ON unmapped_skus FOR ALL TO service_role USING (true) WITH CHECK (true);
