-- Track month-end closing runs
CREATE TABLE month_end_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_month text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'running',
  pre_snapshot_at timestamptz,
  inventory_adjustment_id text,
  amazon_receipt_id text,
  amazon_receipt_doc text,
  shopify_receipt_id text,
  shopify_receipt_doc text,
  post_snapshot_at timestamptz,
  variance_check_passed boolean,
  variance_details jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE month_end_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to month_end_closings"
  ON month_end_closings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read month_end_closings"
  ON month_end_closings FOR SELECT TO authenticated USING (true);
