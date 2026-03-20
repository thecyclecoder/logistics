-- Add bundle support to products
ALTER TABLE products ADD COLUMN item_type text NOT NULL DEFAULT 'inventory';
ALTER TABLE products ADD COLUMN bundle_id uuid REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN bundle_quantity integer;

CREATE INDEX idx_products_bundle ON products(bundle_id);
CREATE INDEX idx_products_item_type ON products(item_type);
