-- Pilihan per paket tenant (ditampilkan sebagai checkbox di form pendaftaran).
CREATE TABLE IF NOT EXISTS kategori_pilihan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kategori_sewa_id UUID NOT NULL REFERENCES kategori_sewa(id) ON DELETE CASCADE,
  nama VARCHAR(255) NOT NULL,
  harga NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (harga >= 0),
  urutan INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kategori_pilihan_kategori_idx ON kategori_pilihan(kategori_sewa_id);

ALTER TABLE kategori_pilihan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access kategori pilihan" ON kategori_pilihan;
CREATE POLICY "Admin full access kategori pilihan" ON kategori_pilihan FOR ALL USING (true);
