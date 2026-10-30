-- 001_initial.sql
-- Dana Usaha HMTI - Schema untuk Open Tenant Management

-- Acara (pengaturan)
CREATE TABLE IF NOT EXISTS acara (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(255) NOT NULL DEFAULT 'Dies Natalis HMTI',
  tanggal_acara DATE NOT NULL,
  batas_pelunasan DATE NOT NULL,
  rekening_qris TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kategori Sewa
CREATE TABLE IF NOT EXISTS kategori_sewa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode VARCHAR(10) UNIQUE NOT NULL,
  nama VARCHAR(255) NOT NULL,
  keterangan TEXT,
  include_listrik BOOLEAN DEFAULT true,
  include_trashbag BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Harga Dasar
CREATE TABLE IF NOT EXISTS harga_dasar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kategori_sewa_id UUID REFERENCES kategori_sewa(id) ON DELETE CASCADE,
  jenis_usaha TEXT NOT NULL CHECK (jenis_usaha IN ('F&B', 'Non-F&B')),
  periode TEXT NOT NULL CHECK (periode IN ('early_bird', 'reguler', 'last_minute')),
  harga NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faktor Harga
CREATE TABLE IF NOT EXISTS faktor_harga (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipe TEXT NOT NULL CHECK (tipe IN ('asal', 'lokasi')),
  nilai TEXT NOT NULL,
  multiplier NUMERIC(4, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode_stand VARCHAR(20) UNIQUE NOT NULL,
  nama_usaha VARCHAR(255) NOT NULL,
  kontak VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  kategori_sewa_id UUID REFERENCES kategori_sewa(id),
  jenis_usaha TEXT NOT NULL CHECK (jenis_usaha IN ('F&B', 'Non-F&B')),
  asal TEXT NOT NULL CHECK (asal IN ('Internal Kampus', 'Eksternal')),
  lokasi TEXT NOT NULL CHECK (lokasi IN ('Reguler', 'Strategis 1', 'Strategis 2')),
  periode_daftar TEXT NOT NULL CHECK (periode_daftar IN ('early_bird', 'reguler', 'last_minute')),
  harga_akhir NUMERIC(12, 2) NOT NULL,
  dp_wajib NUMERIC(12, 2) NOT NULL,
  sudah_dibayar NUMERIC(12, 2) DEFAULT 0,
  tgl_daftar DATE NOT NULL DEFAULT CURRENT_DATE,
  tgl_dp DATE,
  tgl_acara DATE,
  status TEXT NOT NULL DEFAULT 'daftar' CHECK (status IN ('daftar', 'dp', 'cicil', 'lunas', 'batal')),
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pembayaran
CREATE TABLE IF NOT EXISTS pembayaran (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  no_transaksi VARCHAR(50) UNIQUE NOT NULL,
  tanggal_bayar DATE NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('DP', 'Cicilan', 'Pelunasan')),
  nominal NUMERIC(12, 2) NOT NULL,
  metode TEXT NOT NULL,
  no_ref VARCHAR(255),
  bukti_url TEXT,
  dicatat_oleh VARCHAR(255),
  keterangan TEXT,
  validated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Merchandise
CREATE TABLE IF NOT EXISTS merchandise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(255) NOT NULL,
  deskripsi TEXT,
  harga NUMERIC(12, 2) NOT NULL,
  stok INTEGER DEFAULT 0,
  gambar_url TEXT,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket
CREATE TABLE IF NOT EXISTS ticket (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(255) NOT NULL,
  harga NUMERIC(12, 2) NOT NULL,
  kuota INTEGER NOT NULL,
  terjual INTEGER DEFAULT 0,
  mulai DATE,
  selesai DATE,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  aksi TEXT NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  ip_address INET,
  user_agent TEXT,
  data_lama JSONB,
  data_baru JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE acara ENABLE ROW LEVEL SECURITY;
ALTER TABLE kategori_sewa ENABLE ROW LEVEL SECURITY;
ALTER TABLE harga_dasar ENABLE ROW LEVEL SECURITY;
ALTER TABLE faktor_harga ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE pembayaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchandise ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public read for merchandise" ON merchandise FOR SELECT USING (true);
CREATE POLICY "Public read for ticket" ON ticket FOR SELECT USING (true);
CREATE POLICY "Admin full access semua tabel" ON acara FOR ALL USING (true);
CREATE POLICY "Admin full access kategori" ON kategori_sewa FOR ALL USING (true);
CREATE POLICY "Admin full access harga" ON harga_dasar FOR ALL USING (true);
CREATE POLICY "Admin full access faktor" ON faktor_harga FOR ALL USING (true);
CREATE POLICY "Admin full access tenant" ON tenants FOR ALL USING (true);
CREATE POLICY "Admin full access pembayaran" ON pembayaran FOR ALL USING (true);
CREATE POLICY "Admin full access audit" ON audit_log FOR ALL USING (true);

-- Insert default data
INSERT INTO kategori_sewa (kode, nama, keterangan) VALUES
('KT-01', 'Tempat aja', 'UMKM bawa/perlengkapan sendiri (minimal fasilitas area)'),
('KT-02', 'Tempat + Tenda + Meja + Kursi (Fullset)', 'Fullset dari panitia'),
('KT-03', 'Meja/Kursi/Tenda saja (Add-On)', 'Bisa dipilih per item');

INSERT INTO faktor_harga (tipe, nilai, multiplier) VALUES
('asal', 'Internal Kampus', 0.90),
('asal', 'Eksternal', 1.00),
('lokasi', 'Reguler', 1.00),
('lokasi', 'Strategis 1', 1.10),
('lokasi', 'Strategis 2', 1.15);

-- Harga dasar dari spreadsheet
INSERT INTO harga_dasar (kategori_sewa_id, jenis_usaha, periode, harga)
SELECT k.id, 'F&B', 'early_bird', h.harga
FROM kategori_sewa k, LATERAL (VALUES (150000), (450000), (100000)) AS h(harga)
WHERE k.kode = CASE h.harga WHEN 150000 THEN 'KT-01' WHEN 450000 THEN 'KT-02' WHEN 100000 THEN 'KT-03' END;

INSERT INTO harga_dasar (kategori_sewa_id, jenis_usaha, periode, harga)
SELECT k.id, 'F&B', 'reguler', h.harga
FROM kategori_sewa k, LATERAL (VALUES (175000), (550000), (125000)) AS h(harga)
WHERE k.kode = CASE h.harga WHEN 175000 THEN 'KT-01' WHEN 550000 THEN 'KT-02' WHEN 125000 THEN 'KT-03' END;

INSERT INTO harga_dasar (kategori_sewa_id, jenis_usaha, periode, harga)
SELECT k.id, 'F&B', 'last_minute', h.harga
FROM kategori_sewa k, LATERAL (VALUES (200000), (650000), (150000)) AS h(harga)
WHERE k.kode = CASE h.harga WHEN 200000 THEN 'KT-01' WHEN 650000 THEN 'KT-02' WHEN 150000 THEN 'KT-03' END;

INSERT INTO harga_dasar (kategori_sewa_id, jenis_usaha, periode, harga)
SELECT k.id, 'Non-F&B', 'early_bird', h.harga
FROM kategori_sewa k, LATERAL (VALUES (100000), (350000), (75000)) AS h(harga)
WHERE k.kode = CASE h.harga WHEN 100000 THEN 'KT-01' WHEN 350000 THEN 'KT-02' WHEN 75000 THEN 'KT-03' END;

INSERT INTO harga_dasar (kategori_sewa_id, jenis_usaha, periode, harga)
SELECT k.id, 'Non-F&B', 'reguler', h.harga
FROM kategori_sewa k, LATERAL (VALUES (125000), (425000), (100000)) AS h(harga)
WHERE k.kode = CASE h.harga WHEN 125000 THEN 'KT-01' WHEN 425000 THEN 'KT-02' WHEN 100000 THEN 'KT-03' END;

INSERT INTO harga_dasar (kategori_sewa_id, jenis_usaha, periode, harga)
SELECT k.id, 'Non-F&B', 'last_minute', h.harga
FROM kategori_sewa k, LATERAL (VALUES (150000), (500000), (125000)) AS h(harga)
WHERE k.kode = CASE h.harga WHEN 150000 THEN 'KT-01' WHEN 500000 THEN 'KT-02' WHEN 125000 THEN 'KT-03' END;
