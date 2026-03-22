-- Map Shopify payment gateway names to normalized processor categories
CREATE TABLE IF NOT EXISTS gateway_mappings (
  gateway_name TEXT PRIMARY KEY,
  processor TEXT NOT NULL  -- shopify_payments, paypal, braintree, gift_card, walmart, other
);

ALTER TABLE gateway_mappings ENABLE ROW LEVEL SECURITY;

-- Seed defaults
INSERT INTO gateway_mappings (gateway_name, processor) VALUES
  ('shopify_payments', 'shopify_payments'),
  ('paypal', 'paypal'),
  ('braintree', 'braintree'),
  ('walmart', 'walmart'),
  ('manual', 'other'),
  ('shop_cash', 'shopify_payments'),
  ('shop_pay', 'shopify_payments'),
  ('gift_card', 'gift_card')
ON CONFLICT (gateway_name) DO NOTHING;
