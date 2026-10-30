-- 003_admin_tables.sql
-- Tables untuk fitur admin: peralatan, kuota stand, stok log, kasir transaksi, promo diskon

CREATE TABLE IF NOT EXISTS peralatan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(100) NOT NULL,
  jenis VARCHAR(50) NOT NULL DEFAULT 'Tenda',
  jumlah INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'tersedia' CHECK (status IN ('tersedia', 'dipinjam', 'rusak')),
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kuota_stand (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_lokasi VARCHAR(100) NOT NULL,
  total INTEGER NOT NULL DEFAULT 10,
  terisi INTEGER NOT NULL DEFAULT 0,
  sisa INTEGER NOT NULL DEFAULT 10,
  koordinat VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stok_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produk VARCHAR(255) NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('masuk', 'keluar')),
  qty INTEGER NOT NULL DEFAULT 1,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kasir_transaksi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produk VARCHAR(255),
  produk_nama VARCHAR(255),
  qty INTEGER NOT NULL DEFAULT 1,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  metode TEXT NOT NULL DEFAULT 'Tunai',
  dicatat_oleh VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_diskon (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode VARCHAR(50) UNIQUE NOT NULL,
  deskripsi TEXT,
  diskon INTEGER NOT NULL DEFAULT 0,
  kuota INTEGER NOT NULL DEFAULT 10,
  terpakai INTEGER NOT NULL DEFAULT 0,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE peralatan ENABLE ROW LEVEL SECURITY;
ALTER TABLE kuota_stand ENABLE ROW LEVEL SECURITY;
ALTER TABLE stok_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE kasir_transaksi ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_diskon ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access peralatan" ON peralatan FOR ALL USING (true);
CREATE POLICY "Admin full access kuota_stand" ON kuota_stand FOR ALL USING (true);
CREATE POLICY "Admin full access stok_log" ON stok_log FOR ALL USING (true);
CREATE POLICY "Admin full access kasir_transaksi" ON kasir_transaksi FOR ALL USING (true);
CREATE POLICY "Admin full access promo_diskon" ON promo_diskon FOR ALL USING (true);

-- Insert sample data
INSERT INTO peralatan (nama, jenis, jumlah, status) VALUES
('Tenda 3x3', 'Tenda', 10, 'tersedia'),
('Meja Plastik', 'Meja', 25, 'tersedia'),
('Kursi Plastik', 'Kursi', 50, 'dipinjam'),
('Lilin Uduk', 'Lilin', 20, 'tersedia'),
('Generator', 'Generator', 2, 'rusak')
ON CONFLICT DO NOTHING;

INSERT INTO kuota_stand (nama_lokasi, total, terisi, sisa, koordinat) VALUES
('Area A - Reguler', 20, 15, 5, 'A1-A20'),
('Area B - Strategis 1', 10, 10, 0, 'B1-B10'),
('Area C - Strategis 2', 8, 3, 5, 'C1-C8'),
('Area D - Food Court', 15, 12, 3, 'D1-D15')
ON CONFLICT DO NOTHING;