-- 025_tenant_kategori_addon.sql
-- Tenant disederhanakan menjadi 2 kategori: Reguler dan Strategis.
-- Add-on (meja/kursi/tenda) memakai harga_sewa pada meta peralatan.

ALTER TABLE pendaftaran_tenant_pub ADD COLUMN IF NOT EXISTS addon JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS addon JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE kategori_sewa SET
  nama = 'Tenant Reguler',
  keterangan = 'Area bersama untuk banyak tenant. Listrik dan trashbag termasuk. Meja/kursi bisa ditambah sebagai add-on.',
  include_listrik = true,
  include_trashbag = true
WHERE kode = 'KT-01';

UPDATE kategori_sewa SET
  nama = 'Tenant Strategis',
  keterangan = 'Slot lokasi strategis dengan jumlah terbatas. Listrik dan trashbag termasuk.',
  include_listrik = true,
  include_trashbag = true
WHERE kode = 'KT-02';

-- Harga tenant sekarang satu harga total per kategori/periode.
-- Samakan harga Non-F&B dengan F&B agar tampilan publik tidak membingungkan.
UPDATE harga_dasar nf SET harga = fb.harga
FROM harga_dasar fb
JOIN kategori_sewa k ON k.id = fb.kategori_sewa_id
WHERE nf.kategori_sewa_id = fb.kategori_sewa_id
  AND nf.periode = fb.periode
  AND nf.jenis_usaha = 'Non-F&B'
  AND fb.jenis_usaha = 'F&B'
  AND k.kode IN ('KT-01', 'KT-02');
