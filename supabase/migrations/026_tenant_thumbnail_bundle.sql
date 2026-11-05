-- Tenant package thumbnail & bundle discount.
-- Bundle: sewa minimal N tenant, diskon nominal dan/atau persen.

ALTER TABLE kategori_sewa ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

CREATE TABLE IF NOT EXISTS kategori_bundle_discount (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kategori_sewa_id UUID NOT NULL REFERENCES kategori_sewa(id) ON DELETE CASCADE,
  jumlah_min INTEGER NOT NULL CHECK (jumlah_min >= 2),
  diskon_nominal NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (diskon_nominal >= 0),
  diskon_persen NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (diskon_persen >= 0 AND diskon_persen <= 100),
  urutan INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kategori_bundle_discount_kategori_idx ON kategori_bundle_discount(kategori_sewa_id);

ALTER TABLE kategori_bundle_discount ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access kategori bundle discount" ON kategori_bundle_discount;
CREATE POLICY "Admin full access kategori bundle discount" ON kategori_bundle_discount FOR ALL USING (true);
