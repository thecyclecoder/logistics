CREATE TABLE shopify_sales_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id text NOT NULL,
  sku text,
  product_name text,
  sale_date date NOT NULL,
  units_sold integer NOT NULL DEFAULT 0,
  revenue numeric(12,4) NOT NULL DEFAULT 0,
  recurring_units integer NOT NULL DEFAULT 0,
  recurring_revenue numeric(12,4) NOT NULL DEFAULT 0,
  first_sub_units integer NOT NULL DEFAULT 0,
  first_sub_revenue numeric(12,4) NOT NULL DEFAULT 0,
  one_time_units integer NOT NULL DEFAULT 0,
  one_time_revenue numeric(12,4) NOT NULL DEFAULT 0,
  refund_units integer NOT NULL DEFAULT 0,
  refund_amount numeric(12,4) NOT NULL DEFAULT 0,
  snapshot_taken_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(variant_id, sale_date)
);

CREATE INDEX idx_shopify_sales_date ON shopify_sales_snapshots(sale_date DESC);
CREATE INDEX idx_shopify_sales_variant ON shopify_sales_snapshots(variant_id);

ALTER TABLE shopify_sales_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to shopify_sales_snapshots"
  ON shopify_sales_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read shopify_sales_snapshots"
  ON shopify_sales_snapshots FOR SELECT TO authenticated USING (true);
