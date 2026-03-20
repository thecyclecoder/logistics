-- Explicit category override so users can manually classify products
-- Values: 'finished_good', 'component', NULL (auto-detect from item_type/bundle_id)
ALTER TABLE products ADD COLUMN product_category text;
