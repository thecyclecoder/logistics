-- Kit mappings: ASIN to Amplifier kit SKU mapping for FBA replenishment
CREATE TABLE kit_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asin TEXT NOT NULL,
  amplifier_kit_sku TEXT NOT NULL,
  transparency_enrolled BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(asin)
);

ALTER TABLE kit_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on kit_mappings"
  ON kit_mappings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated read on kit_mappings"
  ON kit_mappings FOR SELECT
  USING (auth.role() = 'authenticated');
