-- Add unit multiplier to sku_mappings for multi-pack SKUs
-- e.g., Amazon 2-pack ASIN maps to finished good with multiplier=2
ALTER TABLE sku_mappings ADD COLUMN unit_multiplier integer NOT NULL DEFAULT 1;
