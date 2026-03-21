-- Add quantity and dismissed flag for review pages
ALTER TABLE external_skus ADD COLUMN quantity integer;
ALTER TABLE external_skus ADD COLUMN dismissed boolean NOT NULL DEFAULT false;
ALTER TABLE external_skus ADD COLUMN seller_sku text;

-- Remove old seller-SKU-as-ASIN entries (non-ASIN format in amazon source)
-- ASINs are always B0... format, 10 chars
DELETE FROM external_skus
WHERE source = 'amazon'
AND title IS NULL
AND external_id NOT SIMILAR TO 'B0[A-Z0-9]{8}';
