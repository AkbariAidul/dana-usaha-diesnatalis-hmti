-- Daftar tunggu tenant saat slot paket habis.
create table if not exists tenant_waitlist (
  id uuid primary key default gen_random_uuid(),
  kategori_sewa_id uuid not null references kategori_sewa(id) on delete cascade,
  nama_usaha text not null,
  kontak text not null,
  email text,
  alamat text,
  deskripsi_usaha text,
  jumlah_tenant int not null default 1,
  jenis_usaha text,
  jenis_usaha_qty jsonb,
  addon jsonb not null default '[]'::jsonb,
  harga_akhir numeric not null default 0,
  status text not null default 'menunggu'
    check (status in ('menunggu', 'dihubungi', 'selesai', 'batal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kategori_sewa_id, kontak)
);

create index if not exists idx_tenant_waitlist_status on tenant_waitlist (status, created_at desc);
create index if not exists idx_tenant_waitlist_kategori on tenant_waitlist (kategori_sewa_id);
