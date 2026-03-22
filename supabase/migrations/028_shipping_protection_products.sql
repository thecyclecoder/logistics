-- Shopify products that should be treated as shipping income (e.g., Shipping Protection)
CREATE TABLE IF NOT EXISTS shipping_protection_products (
  shopify_product_id TEXT PRIMARY KEY,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE shipping_protection_products ENABLE ROW LEVEL SECURITY;

-- Seed known shipping protection products
INSERT INTO shipping_protection_products (shopify_product_id, title) VALUES
  ('8356945952941', 'Shipping Protection'),
  ('7510145040557', 'Shipping Protection'),
  ('7634377900205', 'Shipping Protection')
ON CONFLICT (shopify_product_id) DO NOTHING;
