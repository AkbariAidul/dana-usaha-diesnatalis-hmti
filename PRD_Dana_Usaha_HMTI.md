# PRD - Dana Usaha HMTI

## 1. Tujuan
Web app untuk mengelola Open Tenant Dana Usaha HMTI, menggantikan spreadsheet Google Sheets.

## 2. Akses Aplikasi

### Halaman Publik (tanpa login)
- `/` - Landing page
- `/tenant-info` - Info Open Tenant (kategori sewa, harga, periode, syarat)
- `/merchandise` - Info Merchandise
- `/ticket` - Info Ticket (tahap, harga, kuota)

### Dashboard (dilindungi PIN)
- Login dengan PIN: `079876` di halaman `/dashboard/login`
- Setelah PIN benar -> session cookie -> akses dashboard
- Tidak ada role/rbac. Hanya PIN gate.

## 3. Fitur Dashboard
- **Tenant**: Daftar, registrasi, detail, kalkulator harga real-time
- **Pembayaran**: Input DP/Cicilan/Pelunasan, upload bukti, tracking sisa
- **Merchandise**: CRUD data (untuk publik)
- **Ticket**: CRUD data (untuk publik)
- **Pengaturan Acara**: Tanggal acara, batas pelunasan, rekening/QRIS
- **Master Harga**: Kategori sewa, harga dasar, faktor (asal/lokasi/jenis usaha)
- **Laporan**: Rekap pembayaran, piutang, export CSV
- **Audit Log**: Riwayat aktivitas

## 4. Aturan Bisnis
- Kategori: Tempat aja | Fullset (Tenda+Meja+Kursi) | Add-On (Meja/Kursi/Tenda). Listrik & Trashbag INCLUDED.
- Periode: Early Bird 16-28 Nov | Reguler 29 Nov-12 Des | Last Minute 13-19 Des
- Faktor: Asal Internal x0.9 / Eksternal x1.0. Lokasi Reguler x1.0 / Strategis 1 x1.1 / Strategis 2 x1.15.
- DP 50%. Cicilan mulai H+1 s/d Hari H. Hari tersisa = MAX(0, tgl_acara - tgl_dp - 1). Minimal cicilan/hari = CEIL(sisa/hari_tersisa). Bisa lump sum.
- Status: Belum Lunas / Menunggak / Sudah Lunas

## 5. Tech Stack
- Next.js 15 (App Router) + TypeScript + Tailwind CSS v4
- shadcn/ui + lucide-react
- react-hook-form + zod
- @tanstack/react-table, recharts, date-fns, sonner
- Supabase (Postgres + RLS + Storage)

## 6. Supabase Connection
Gunakan **Supabase MCP** atau **Supabase CLI** agar tidak perlu run SQL manual.
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_REF=
SUPABASE_ACCESS_TOKEN=
```

Tabel: `acara`, `kategori_sewa`, `harga_dasar`, `faktor_harga`, `tenants`, `pembayaran`, `merchandise`, `ticket`, `audit_log`

## 7. Security
- Halaman publik bebas akses
- Dashboard: PIN server-side validation (`079876`) via httpOnly cookie
- RLS Supabase + Zod server validation
- Upload: whitelist jpg/jpeg/png/webp/pdf max 5MB, signed URL
- SERVICE_ROLE_KEY hanya server-side
- Audit log untuk aksi penting

## 8. MVP Scope
1. Public pages (home, tenant-info, merchandise, ticket)
2. PIN login dashboard (`079876`)
3. CRUD Tenant + kalkulator harga
4. CRUD Pembayaran + tracking cicilan
5. CRUD Merchandise & Ticket
6. Master Harga & Pengaturan Acara
7. Laporan + CSV export
8. Audit log
