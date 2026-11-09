-- 045_storage_buckets.sql
-- Provision semua bucket Storage yang dipakai aplikasi. Idempoten: aman dijalankan ulang.
-- Bucket `bukti` sudah dibuat di 006_storage_bukti.sql.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('bukti-tenant', 'bukti-tenant', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png', 'application/pdf']),
  ('bukti-bayar', 'bukti-bayar', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png', 'application/pdf']),
  ('kasir-bukti', 'kasir-bukti', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png']),
  ('bukti-tiket', 'bukti-tiket', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png', 'application/pdf']),
  ('bukti-po', 'bukti-po', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png', 'application/pdf']),
  ('merchandise-images', 'merchandise-images', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png']),
  ('ticket-thumbnail', 'ticket-thumbnail', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png']),
  ('tenant-thumbnail', 'tenant-thumbnail', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png']),
  ('tenant-pilihan-gambar', 'tenant-pilihan-gambar', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png']),
  ('bundle-images', 'bundle-images', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
SET public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
