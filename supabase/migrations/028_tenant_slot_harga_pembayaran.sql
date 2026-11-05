-- Slot tenant per paket, jumlah tenant yang disewa, dan tipe pembayaran.
ALTER TABLE kategori_sewa ADD COLUMN IF NOT EXISTS slot_tenant INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kategori_sewa DROP CONSTRAINT IF EXISTS kategori_sewa_slot_tenant_check;
ALTER TABLE kategori_sewa ADD CONSTRAINT kategori_sewa_slot_tenant_check CHECK (slot_tenant >= 0);

ALTER TABLE pendaftaran_tenant_pub ADD COLUMN IF NOT EXISTS jumlah_tenant INTEGER NOT NULL DEFAULT 1;
ALTER TABLE pendaftaran_tenant_pub ADD COLUMN IF NOT EXISTS pembayaran_tipe TEXT NOT NULL DEFAULT 'nyicil';
ALTER TABLE pendaftaran_tenant_pub ADD COLUMN IF NOT EXISTS nominal_bayar NUMERIC(12, 2);

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS jumlah_tenant INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pembayaran_tipe TEXT;
