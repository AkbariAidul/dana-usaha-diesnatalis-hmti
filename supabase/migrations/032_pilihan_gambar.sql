-- Tambah kolom gambar_url ke kategori_pilihan agar penyewa bisa melihat
-- foto ilustrasi tiap pilihan paket (kursi, meja, tenda, dll.) saat mendaftar.
ALTER TABLE kategori_pilihan
  ADD COLUMN IF NOT EXISTS gambar_url TEXT;
