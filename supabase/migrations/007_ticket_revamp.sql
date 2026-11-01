-- Ticket revamp: ticket types can cover multiple people, event-day sales,
-- and date-range prices. Normal tickets leave kuota at 0 (unlimited).

ALTER TABLE tiket_tipe
  ADD COLUMN IF NOT EXISTS jumlah_orang INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_hari_h BOOLEAN NOT NULL DEFAULT false;

-- Normal tickets are not quota-based anymore; only Hari H tickets keep kuota.
UPDATE tiket_tipe SET kuota = 0 WHERE is_hari_h = false AND kuota > 0;

CREATE TABLE IF NOT EXISTS tiket_periode (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tiket_tipe_id UUID NOT NULL REFERENCES tiket_tipe(id) ON DELETE CASCADE,
  nama VARCHAR(100),
  tanggal_mulai DATE NOT NULL,
  tanggal_selesai DATE NOT NULL,
  harga NUMERIC(12, 2) NOT NULL,
  urutan INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (tanggal_selesai >= tanggal_mulai),
  CHECK (harga >= 0)
);

CREATE INDEX IF NOT EXISTS tiket_periode_tipe_idx ON tiket_periode(tiket_tipe_id);

ALTER TABLE tiket_periode ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access tiket periode" ON tiket_periode;
CREATE POLICY "Admin full access tiket periode" ON tiket_periode FOR ALL USING (true);
