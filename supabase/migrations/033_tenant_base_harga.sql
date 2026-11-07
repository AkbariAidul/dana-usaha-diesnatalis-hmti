-- 033_tenant_base_harga.sql
-- Tambah kolom base_harga ke tabel tenants agar harga sewa tempat per kategori
-- bisa ditampilkan terpisah dari total (yang sudah termasuk pilihan paket & addon).
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS base_harga NUMERIC(12, 2) NOT NULL DEFAULT 0;
