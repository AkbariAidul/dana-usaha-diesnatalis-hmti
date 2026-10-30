-- 002_public_flows.sql
-- Public flows: Tenant pendaftaran publik, PO Merchandise, Ticketing

-- Drop existing policies if they exist (for idempotent migrations)
DO $$
BEGIN
  -- Drop policies
  BEGIN DROP POLICY "Admin full access pengaturan" ON pengaturan_umum; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY "Public read aktif tiket tipe" ON tiket_tipe; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY "Public read merch varian" ON merch_varian; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY "Admin full access semua publik flow" ON pendaftaran_tenant_pub; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY "Admin full access merch po" ON merch_po; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY "Admin full access merch po item" ON merch_po_item; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY "Admin full access tiket tipe" ON tiket_tipe; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY "Admin full access pesanan tiket" ON pesanan_tiket; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY "Admin full access tiket issued" ON tiket_issued; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY "Admin full access checkin log" ON checkin_log; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE TABLE IF NOT EXISTS pengaturan_umum (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pendaftaran_tenant_pub (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode_pendaftaran VARCHAR(30) UNIQUE NOT NULL,
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
  tgl_acara DATE,
  status TEXT NOT NULL DEFAULT 'menunggu_verifikasi' CHECK (status IN ('menunggu_verifikasi','dp_diterima','ditolak','cicil','lunas','batal')),
  alamat TEXT,
  deskripsi_usaha TEXT,
  bukti_url TEXT,
  catatan_admin TEXT,
  verified_by VARCHAR(255),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merch_varian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(100) NOT NULL,
  urutan INTEGER DEFAULT 0,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merch_po (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no_po VARCHAR(30) UNIQUE NOT NULL,
  nama_pemesan VARCHAR(255) NOT NULL,
  kontak VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  tipe_pemesan TEXT NOT NULL CHECK (tipe_pemesan IN ('Pengurus Himpunan','Umum')),
  harga_per_item NUMERIC(12, 2) NOT NULL,
  total NUMERIC(12, 2) NOT NULL,
  sudah_dibayar NUMERIC(12, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'menunggu_verifikasi' CHECK (status IN ('menunggu_verifikasi','dp_diterima','lunas','ditolak','batal')),
  bukti_url TEXT,
  catatan_admin TEXT,
  verified_by VARCHAR(255),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merch_po_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES merch_po(id) ON DELETE CASCADE,
  varian_id UUID REFERENCES merch_varian(id),
  ukuran VARCHAR(10),
  qty INTEGER NOT NULL DEFAULT 1,
  harga_satuan NUMERIC(12, 2) NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS tiket_tipe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(100) NOT NULL,
  deskripsi TEXT,
  harga NUMERIC(12, 2) NOT NULL,
  kuota INTEGER DEFAULT 0,
  terjual INTEGER DEFAULT 0,
  urutan INTEGER DEFAULT 0,
  aktif BOOLEAN DEFAULT true,
  mulai_jual TIMESTAMPTZ,
  selesai_jual TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pesanan_tiket (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no_pesanan VARCHAR(30) UNIQUE NOT NULL,
  nama_pembeli VARCHAR(255) NOT NULL,
  kontak VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  tiket_tipe_id UUID REFERENCES tiket_tipe(id),
  jumlah INTEGER NOT NULL DEFAULT 1,
  harga_satuan NUMERIC(12, 2) NOT NULL,
  total NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'menunggu_verifikasi' CHECK (status IN ('menunggu_verifikasi','lunas','ditolak','batal')),
  bukti_url TEXT,
  catatan_admin TEXT,
  verified_by VARCHAR(255),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tiket_issued (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pesanan_id UUID REFERENCES pesanan_tiket(id) ON DELETE CASCADE,
  kode_qr VARCHAR(64) UNIQUE NOT NULL,
  kode_tampil VARCHAR(40) UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'belum_divalidasi' CHECK (status IN ('belum_divalidasi','terpakai')),
  digunakan_oleh VARCHAR(255),
  digunakan_pada TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checkin_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tiket_issued_id UUID REFERENCES tiket_issued(id),
  kode_qr VARCHAR(64),
  aksi VARCHAR(50) DEFAULT 'checkin',
  dicatat_oleh VARCHAR(255),
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pengaturan_umum ENABLE ROW LEVEL SECURITY;
ALTER TABLE pendaftaran_tenant_pub ENABLE ROW LEVEL SECURITY;
ALTER TABLE merch_varian ENABLE ROW LEVEL SECURITY;
ALTER TABLE merch_po ENABLE ROW LEVEL SECURITY;
ALTER TABLE merch_po_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiket_tipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE pesanan_tiket ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiket_issued ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access pengaturan" ON pengaturan_umum FOR ALL USING (true);
CREATE POLICY "Public read aktif tiket tipe" ON tiket_tipe FOR SELECT USING (aktif = true);
CREATE POLICY "Public read merch varian" ON merch_varian FOR SELECT USING (true);
CREATE POLICY "Admin full access semua publik flow" ON pendaftaran_tenant_pub FOR ALL USING (true);
CREATE POLICY "Admin full access merch po" ON merch_po FOR ALL USING (true);
CREATE POLICY "Admin full access merch po item" ON merch_po_item FOR ALL USING (true);
CREATE POLICY "Admin full access tiket tipe" ON tiket_tipe FOR ALL USING (true);
CREATE POLICY "Admin full access pesanan tiket" ON pesanan_tiket FOR ALL USING (true);
CREATE POLICY "Admin full access tiket issued" ON tiket_issued FOR ALL USING (true);
CREATE POLICY "Admin full access checkin log" ON checkin_log FOR ALL USING (true);

INSERT INTO merch_varian (nama, urutan) VALUES
('S',1),('M',2),('L',3),('XL',4),('XXL',5)
ON CONFLICT DO NOTHING;
