-- Dedicated 3PL inventory snapshots for daily cron and auditing
CREATE TABLE tpl_inventory_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL,
  name text,
  quantity_on_hand integer NOT NULL DEFAULT 0,
  quantity_available integer NOT NULL DEFAULT 0,
  quantity_committed integer NOT NULL DEFAULT 0,
  quantity_expected integer NOT NULL DEFAULT 0,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sku, snapshot_date)
);

CREATE INDEX idx_tpl_snapshots_date ON tpl_inventory_snapshots(snapshot_date DESC);
CREATE INDEX idx_tpl_snapshots_sku ON tpl_inventory_snapshots(sku);

ALTER TABLE tpl_inventory_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to tpl_inventory_snapshots"
  ON tpl_inventory_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read tpl_inventory_snapshots"
  ON tpl_inventory_snapshots FOR SELECT TO authenticated USING (true);
