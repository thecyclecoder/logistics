-- Add journal entry tracking to month_end_closings
ALTER TABLE month_end_closings
  ADD COLUMN IF NOT EXISTS shopify_journal_entry_id TEXT,
  ADD COLUMN IF NOT EXISTS shopify_journal_entry_doc TEXT;
