-- 044_bundle_harga_coret.sql
-- Harga normal (dicoret) yang bisa diisi manual per paket combo.
-- NULL = otomatis dari total harga komponen.

ALTER TABLE bundle ADD COLUMN IF NOT EXISTS harga_coret NUMERIC(12, 2);
