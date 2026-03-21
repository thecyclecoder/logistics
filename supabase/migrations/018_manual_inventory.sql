-- Manual inventory entries for components held at co-manufacturers, etc.
CREATE TABLE manual_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL,
  location text NOT NULL,
  note text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_manual_inventory_product ON manual_inventory(product_id);

ALTER TABLE manual_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to manual_inventory"
  ON manual_inventory FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to manual_inventory"
  ON manual_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
