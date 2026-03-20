-- Cache of all SKUs/ASINs seen from external platforms
-- Populated during inventory sync, used to populate mapping dropdowns
CREATE TABLE external_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL,
  source text NOT NULL,
  label text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(external_id, source)
);

CREATE INDEX idx_external_skus_source ON external_skus(source);

ALTER TABLE external_skus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users have full access to external_skus"
  ON external_skus FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to external_skus"
  ON external_skus FOR ALL TO service_role USING (true) WITH CHECK (true);
