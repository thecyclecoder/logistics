-- Payment processor monthly summaries for journal entries
CREATE TABLE IF NOT EXISTS payment_processor_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  closing_month TEXT NOT NULL,
  processor TEXT NOT NULL,
  gross_sales NUMERIC(12,4) DEFAULT 0,
  processing_fees NUMERIC(12,4) DEFAULT 0,
  refunds NUMERIC(12,4) DEFAULT 0,
  chargebacks NUMERIC(12,4) DEFAULT 0,
  adjustments NUMERIC(12,4) DEFAULT 0,
  net_deposits NUMERIC(12,4) DEFAULT 0,
  raw_payload JSONB,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(closing_month, processor)
);

ALTER TABLE payment_processor_summaries ENABLE ROW LEVEL SECURITY;
