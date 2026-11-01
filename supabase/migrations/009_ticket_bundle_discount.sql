-- Add diskon_persen column to pesanan_tiket for bundle discount tracking
ALTER TABLE pesanan_tiket
  ADD COLUMN IF NOT EXISTS diskon_persen NUMERIC(5,2) DEFAULT 0;
