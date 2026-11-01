-- 005_public_history_qr.sql
-- Riwayat publik, QR venue/pickup, data pengurus, dan perbaikan status tenant.

CREATE TABLE IF NOT EXISTS pengurus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(255) NOT NULL,
  divisi VARCHAR(100),
  kontak VARCHAR(50),
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS pengurus_nama_divisi_key
  ON pengurus (LOWER(nama), LOWER(COALESCE(divisi, '')));

ALTER TABLE merch_po
  ADD COLUMN IF NOT EXISTS pengurus_id UUID REFERENCES pengurus(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS picked_up_by VARCHAR(255);

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS venue_checked_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS venue_checked_in_by VARCHAR(255);

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants
  ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('daftar', 'dp', 'cicil', 'lunas', 'batal', 'menunggak'));

INSERT INTO pengaturan_umum (key, value)
VALUES ('po_harga', '75000')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE pengurus ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access pengurus" ON pengurus;
CREATE POLICY "Admin full access pengurus" ON pengurus FOR ALL USING (true);
