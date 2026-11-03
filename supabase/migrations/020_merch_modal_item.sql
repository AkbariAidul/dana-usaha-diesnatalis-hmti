CREATE TABLE IF NOT EXISTS merch_modal_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(150) NOT NULL,
  harga NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (harga >= 0),
  urutan INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE merch_modal_item ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access merch modal item" ON merch_modal_item;
CREATE POLICY "Admin full access merch modal item" ON merch_modal_item FOR ALL USING (true);
