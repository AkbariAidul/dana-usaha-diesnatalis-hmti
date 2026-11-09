-- 043_bundle_combo.sql
-- Paket combo: tiket + merchandise dibeli dalam satu paket dengan satu pembayaran.

CREATE TABLE IF NOT EXISTS bundle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  deskripsi TEXT,
  gambar_url TEXT,
  harga_bundle NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (harga_bundle >= 0),
  aktif BOOLEAN NOT NULL DEFAULT true,
  tgl_mulai TIMESTAMPTZ,
  tgl_selesai TIMESTAMPTZ,
  kuota INTEGER NOT NULL DEFAULT 0,
  urutan INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bundle_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES bundle(id) ON DELETE CASCADE,
  tipe TEXT NOT NULL CHECK (tipe IN ('tiket', 'merch')),
  ref_id UUID NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
  urutan INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS bundle_item_bundle_idx ON bundle_item(bundle_id);

CREATE TABLE IF NOT EXISTS bundle_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no_pesanan TEXT UNIQUE NOT NULL,
  bundle_id UUID REFERENCES bundle(id),
  nama_pembeli TEXT NOT NULL,
  kontak TEXT NOT NULL,
  email TEXT,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'menunggu_verifikasi'
    CHECK (status IN ('menunggu_verifikasi', 'lunas', 'ditolak', 'batal')),
  bukti_url TEXT,
  catatan_admin TEXT,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  tiket_pesanan_id UUID REFERENCES pesanan_tiket(id),
  merch_po_id UUID REFERENCES merch_po(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bundle_order_status_idx ON bundle_order(status);

CREATE TABLE IF NOT EXISTS bundle_order_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_order_id UUID NOT NULL REFERENCES bundle_order(id) ON DELETE CASCADE,
  tipe TEXT NOT NULL CHECK (tipe IN ('tiket', 'merch')),
  ref_id UUID NOT NULL,
  nama_snapshot TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  varian_id UUID,
  ukuran TEXT,
  warna TEXT,
  lengan TEXT,
  harga_satuan NUMERIC(12, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS bundle_order_item_order_idx ON bundle_order_item(bundle_order_id);

-- Penanda record hilir yang berasal dari paket combo (untuk laporan & ops).
ALTER TABLE pesanan_tiket ADD COLUMN IF NOT EXISTS bundle_order_id UUID REFERENCES bundle_order(id) ON DELETE SET NULL;
ALTER TABLE merch_po ADD COLUMN IF NOT EXISTS bundle_order_id UUID REFERENCES bundle_order(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pesanan_tiket_bundle_idx ON pesanan_tiket(bundle_order_id);
CREATE INDEX IF NOT EXISTS merch_po_bundle_idx ON merch_po(bundle_order_id);

ALTER TABLE bundle ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_order_item ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access bundle" ON bundle;
CREATE POLICY "Admin full access bundle" ON bundle FOR ALL USING (true);

DROP POLICY IF EXISTS "Admin full access bundle item" ON bundle_item;
CREATE POLICY "Admin full access bundle item" ON bundle_item FOR ALL USING (true);

DROP POLICY IF EXISTS "Admin full access bundle order" ON bundle_order;
CREATE POLICY "Admin full access bundle order" ON bundle_order FOR ALL USING (true);

DROP POLICY IF EXISTS "Admin full access bundle order item" ON bundle_order_item;
CREATE POLICY "Admin full access bundle order item" ON bundle_order_item FOR ALL USING (true);
