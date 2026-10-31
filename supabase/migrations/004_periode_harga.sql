-- 004_periode_harga.sql
-- Periode harga tenant sekarang dinamis (disimpan di pengaturan_umum key 'periode_harga'),
-- jadi batasan enum lama perlu dilepas agar periode baru bisa dipakai.
-- Jalankan file ini sekali di Supabase SQL Editor sebelum menambah periode baru.

ALTER TABLE harga_dasar DROP CONSTRAINT IF EXISTS harga_dasar_periode_check;
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_periode_daftar_check;
ALTER TABLE pendaftaran_tenant_pub DROP CONSTRAINT IF EXISTS pendaftaran_tenant_pub_periode_daftar_check;
