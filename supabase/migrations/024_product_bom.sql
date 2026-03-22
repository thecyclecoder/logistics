-- Multi-parent BOM: a component can belong to multiple parent Group items
CREATE TABLE IF NOT EXISTS product_bom (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES products(id),
  component_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC(10,4) NOT NULL DEFAULT 1,
  UNIQUE(parent_id, component_id)
);

ALTER TABLE product_bom ENABLE ROW LEVEL SECURITY;

-- Seed from existing bundle_id/bundle_quantity on products
INSERT INTO product_bom (parent_id, component_id, quantity)
SELECT bundle_id, id, COALESCE(bundle_quantity, 1)
FROM products
WHERE bundle_id IS NOT NULL
ON CONFLICT (parent_id, component_id) DO NOTHING;
