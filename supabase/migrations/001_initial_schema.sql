-- Enum types
CREATE TYPE source_type AS ENUM ('amazon', '3pl', 'shopify', 'manual');
CREATE TYPE inventory_source_type AS ENUM ('amazon_fba', 'amazon_fbm', '3pl', 'quickbooks');
CREATE TYPE channel_type AS ENUM ('amazon', 'shopify');
CREATE TYPE cron_status_type AS ENUM ('running', 'success', 'error');

-- Products
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quickbooks_id text UNIQUE NOT NULL,
  quickbooks_name text NOT NULL,
  sku text,
  category text,
  unit_cost numeric(12,4),
  reorder_point integer NOT NULL DEFAULT 0,
  lead_time_days integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_qb_id ON products(quickbooks_id);
CREATE INDEX idx_products_sku ON products(sku);

-- SKU Mappings
CREATE TABLE sku_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  source source_type NOT NULL,
  label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(external_id, source)
);

CREATE INDEX idx_sku_mappings_product ON sku_mappings(product_id);
CREATE INDEX idx_sku_mappings_external ON sku_mappings(external_id, source);

-- Inventory Snapshots
CREATE TABLE inventory_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  source inventory_source_type NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  raw_payload jsonb
);

CREATE INDEX idx_snapshots_product_source ON inventory_snapshots(product_id, source);
CREATE INDEX idx_snapshots_at ON inventory_snapshots(snapshot_at DESC);

-- Sale Records
CREATE TABLE sale_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  channel channel_type NOT NULL,
  order_id text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  gross_amount numeric(12,4) NOT NULL DEFAULT 0,
  refund_amount numeric(12,4) NOT NULL DEFAULT 0,
  fee_amount numeric(12,4) NOT NULL DEFAULT 0,
  net_amount numeric(12,4) NOT NULL DEFAULT 0,
  sale_date date NOT NULL,
  period_month text NOT NULL,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_product ON sale_records(product_id);
CREATE INDEX idx_sales_period ON sale_records(period_month);
CREATE INDEX idx_sales_channel ON sale_records(channel);
CREATE INDEX idx_sales_order ON sale_records(order_id);

-- Cron Logs
CREATE TABLE cron_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status cron_status_type NOT NULL DEFAULT 'running',
  records_processed integer,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX idx_cron_logs_job ON cron_logs(job_name);
CREATE INDEX idx_cron_logs_started ON cron_logs(started_at DESC);

-- View: current_inventory
-- Latest snapshot per product per source, pivoted into columns
CREATE OR REPLACE VIEW current_inventory AS
WITH latest AS (
  SELECT DISTINCT ON (product_id, source)
    product_id,
    source,
    quantity,
    snapshot_at
  FROM inventory_snapshots
  ORDER BY product_id, source, snapshot_at DESC
)
SELECT
  p.id AS product_id,
  p.quickbooks_name,
  p.sku,
  p.reorder_point,
  COALESCE(MAX(CASE WHEN l.source = 'amazon_fba' THEN l.quantity END), 0) AS amazon_fba,
  COALESCE(MAX(CASE WHEN l.source = 'amazon_fbm' THEN l.quantity END), 0) AS amazon_fbm,
  COALESCE(MAX(CASE WHEN l.source = '3pl' THEN l.quantity END), 0) AS three_pl,
  COALESCE(MAX(CASE WHEN l.source = 'quickbooks' THEN l.quantity END), 0) AS quickbooks,
  COALESCE(MAX(CASE WHEN l.source = 'amazon_fba' THEN l.quantity END), 0) +
  COALESCE(MAX(CASE WHEN l.source = 'amazon_fbm' THEN l.quantity END), 0) +
  COALESCE(MAX(CASE WHEN l.source = '3pl' THEN l.quantity END), 0) +
  COALESCE(MAX(CASE WHEN l.source = 'quickbooks' THEN l.quantity END), 0) AS total,
  MAX(l.snapshot_at) AS last_snapshot_at
FROM products p
LEFT JOIN latest l ON l.product_id = p.id
WHERE p.active = true
GROUP BY p.id, p.quickbooks_name, p.sku, p.reorder_point;

-- View: monthly_sales_summary
CREATE OR REPLACE VIEW monthly_sales_summary AS
SELECT
  s.period_month,
  s.channel,
  s.product_id,
  p.quickbooks_name,
  COUNT(DISTINCT s.order_id) AS order_count,
  SUM(s.quantity) AS total_quantity,
  SUM(s.gross_amount) AS total_gross,
  SUM(s.refund_amount) AS total_refunds,
  SUM(s.fee_amount) AS total_fees,
  SUM(s.net_amount) AS total_net
FROM sale_records s
JOIN products p ON p.id = s.product_id
GROUP BY s.period_month, s.channel, s.product_id, p.quickbooks_name;

-- RLS Policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users have full access to products"
  ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to sku_mappings"
  ON sku_mappings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to inventory_snapshots"
  ON inventory_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to sale_records"
  ON sale_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to cron_logs"
  ON cron_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_products
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_sku_mappings
  BEFORE UPDATE ON sku_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
