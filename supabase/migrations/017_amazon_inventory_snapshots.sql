-- Daily Amazon FBA inventory snapshots for audit tracking
CREATE TABLE amazon_inventory_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asin text NOT NULL,
  seller_sku text,
  fn_sku text,
  quantity_fulfillable integer NOT NULL DEFAULT 0,
  quantity_inbound integer NOT NULL DEFAULT 0,
  quantity_reserved integer NOT NULL DEFAULT 0,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(asin, snapshot_date)
);

CREATE INDEX idx_amz_inv_date ON amazon_inventory_snapshots(snapshot_date DESC);
CREATE INDEX idx_amz_inv_asin ON amazon_inventory_snapshots(asin);

ALTER TABLE amazon_inventory_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to amazon_inventory_snapshots"
  ON amazon_inventory_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read amazon_inventory_snapshots"
  ON amazon_inventory_snapshots FOR SELECT TO authenticated USING (true);
