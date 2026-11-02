ALTER TABLE merch_po
  ADD COLUMN IF NOT EXISTS pembayaran_metode TEXT,
  ADD COLUMN IF NOT EXISTS pembayaran_tipe TEXT;
