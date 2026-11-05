-- Status aktif paket tenant dan selisih harga Non-F&B dari harga F&B.
ALTER TABLE kategori_sewa ADD COLUMN IF NOT EXISTS aktif BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE kategori_sewa ADD COLUMN IF NOT EXISTS selisih_nonfnb NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE kategori_sewa DROP CONSTRAINT IF EXISTS kategori_sewa_selisih_nonfnb_check;
ALTER TABLE kategori_sewa ADD CONSTRAINT kategori_sewa_selisih_nonfnb_check CHECK (selisih_nonfnb >= 0);
