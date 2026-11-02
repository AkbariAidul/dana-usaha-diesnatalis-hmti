-- Allow a merchandise product to be sold without a stock limit.
ALTER TABLE merchandise
  ADD COLUMN IF NOT EXISTS stok_unlimited BOOLEAN NOT NULL DEFAULT false;
