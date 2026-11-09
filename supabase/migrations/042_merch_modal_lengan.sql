ALTER TABLE merch_modal_item
  ADD COLUMN IF NOT EXISTS harga_pengurus_pendek NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (harga_pengurus_pendek >= 0),
  ADD COLUMN IF NOT EXISTS harga_pengurus_panjang NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (harga_pengurus_panjang >= 0),
  ADD COLUMN IF NOT EXISTS harga_umum_pendek NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (harga_umum_pendek >= 0),
  ADD COLUMN IF NOT EXISTS harga_umum_panjang NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (harga_umum_panjang >= 0);

-- Salin harga legacy ke keempat variasi apabila belum pernah diisi
UPDATE merch_modal_item
SET harga_pengurus_pendek = harga,
    harga_pengurus_panjang = harga,
    harga_umum_pendek = harga,
    harga_umum_panjang = harga
WHERE harga > 0
  AND harga_pengurus_pendek = 0
  AND harga_pengurus_panjang = 0
  AND harga_umum_pendek = 0
  AND harga_umum_panjang = 0;
