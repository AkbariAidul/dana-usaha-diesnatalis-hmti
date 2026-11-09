ALTER TABLE merchandise
  ADD COLUMN IF NOT EXISTS harga_po_panjang NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS harga_po_umum NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS harga_po_umum_panjang NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS harga_hari_h_panjang NUMERIC(12, 2) NOT NULL DEFAULT 0;

UPDATE merchandise
SET harga_po_umum = harga_po
WHERE harga_po_umum = 0 AND harga_po IS NOT NULL AND harga_po > 0;

ALTER TABLE merch_po_item
  ADD COLUMN IF NOT EXISTS warna TEXT,
  ADD COLUMN IF NOT EXISTS lengan TEXT;

ALTER TABLE kasir_transaksi
  ADD COLUMN IF NOT EXISTS warna TEXT,
  ADD COLUMN IF NOT EXISTS lengan TEXT;
