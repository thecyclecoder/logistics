-- Daily Amazon sales snapshots by ASIN, with SNS bucketing
CREATE TABLE amazon_sales_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asin text NOT NULL,
  seller_sku text,
  product_name text,
  sale_date date NOT NULL,
  units_shipped integer NOT NULL DEFAULT 0,
  revenue numeric(12,4) NOT NULL DEFAULT 0,
  units_pending integer NOT NULL DEFAULT 0,
  units_cancelled integer NOT NULL DEFAULT 0,
  recurring_units integer NOT NULL DEFAULT 0,
  recurring_revenue numeric(12,4) NOT NULL DEFAULT 0,
  sns_checkout_units integer NOT NULL DEFAULT 0,
  sns_checkout_revenue numeric(12,4) NOT NULL DEFAULT 0,
  one_time_units integer NOT NULL DEFAULT 0,
  one_time_revenue numeric(12,4) NOT NULL DEFAULT 0,
  snapshot_taken_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(asin, sale_date)
);

CREATE INDEX idx_amz_sales_date ON amazon_sales_snapshots(sale_date DESC);
CREATE INDEX idx_amz_sales_asin ON amazon_sales_snapshots(asin);

ALTER TABLE amazon_sales_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to amazon_sales_snapshots"
  ON amazon_sales_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read amazon_sales_snapshots"
  ON amazon_sales_snapshots FOR SELECT TO authenticated USING (true);
