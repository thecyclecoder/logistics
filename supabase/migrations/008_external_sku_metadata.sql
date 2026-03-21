-- Add rich metadata to external_skus for Amazon catalog data (title, image, price)
ALTER TABLE external_skus ADD COLUMN title text;
ALTER TABLE external_skus ADD COLUMN image_url text;
ALTER TABLE external_skus ADD COLUMN price numeric(12,4);
ALTER TABLE external_skus ADD COLUMN parent_asin text;
ALTER TABLE external_skus ADD COLUMN item_type text; -- 'child', 'standalone', 'parent'
