-- Add combined FBA transit column (inbound working + shipped + receiving + reserved)
ALTER TABLE amazon_inventory_snapshots ADD COLUMN quantity_transit integer NOT NULL DEFAULT 0;
