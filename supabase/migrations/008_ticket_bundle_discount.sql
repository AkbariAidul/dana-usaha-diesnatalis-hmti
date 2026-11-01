-- Ticket bundling discount: quantity-based discount per ticket type.
-- e.g., beli 2 = diskon 10%, beli 3 = diskon 15%

CREATE TABLE IF NOT EXISTS tiket_bundle_discount (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tiket_tipe_id UUID NOT NULL REFERENCES tiket_tipe(id) ON DELETE CASCADE,
  jumlah_min INTEGER NOT NULL CHECK (jumlah_min >= 2),
  diskon_persen NUMERIC(5,2) NOT NULL CHECK (diskon_persen >= 0 AND diskon_persen <= 100),
  urutan INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tiket_bundle_discount_tipe_idx ON tiket_bundle_discount(tiket_tipe_id);

ALTER TABLE tiket_bundle_discount ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access tiket bundle discount" ON tiket_bundle_discount;
CREATE POLICY "Admin full access tiket bundle discount" ON tiket_bundle_discount FOR ALL USING (true);
