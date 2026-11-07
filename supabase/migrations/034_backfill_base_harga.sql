-- 034_backfill_base_harga.sql
-- Isi ulang base_harga untuk tenant yang sudah ada sebelum kolom ini ditambahkan.
-- Harga dasar diambil dari harga_dasar sesuai kategori × periode × jenis_usaha tenant.
UPDATE tenants t
SET base_harga = COALESCE(
  (
    SELECT hd.harga * t.jumlah_tenant
    FROM harga_dasar hd
    WHERE hd.kategori_sewa_id = t.kategori_sewa_id
      AND hd.periode = t.periode_daftar
      AND hd.jenis_usaha = t.jenis_usaha
    LIMIT 1
  ),
  t.harga_akhir
)
WHERE t.base_harga = 0;
