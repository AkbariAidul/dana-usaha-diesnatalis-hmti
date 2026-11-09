# Dana Usaha HMTI — In4Days XI

Sistem pengelolaan Dana Usaha HMTI: pendaftaran tenant, penjualan tiket, pre-order merchandise, paket combo, pembayaran, scan QR, dan laporan.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- Supabase (Postgres + Storage)
- Fonnte (WhatsApp), Cloudflare Turnstile
- PDF (`pdf-lib`), Excel (`write-excel-file`), QR (`qrcode`, `html5-qrcode`)

## Prasyarat

- Node.js 20+
- Project Supabase (URL, anon key, service role key)
- Token Fonnte dan widget Turnstile untuk production

## Setup lokal

```bash
npm install
cp .env.example .env.local
npm run dev
```

Isi `.env.local` minimal:

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ya | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ya | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ya | Service role key (server only) |
| `DASHBOARD_SESSION_SECRET` | production | Secret tanda tangan sesi dashboard |
| `DASHBOARD_PIN` / `DASHBOARD_PIN_*` | ya | PIN login dashboard per role |
| `PUBLIC_LINK_SECRET` | production | HMAC link lacak publik |
| `FONNTE_TOKEN` | production | Notifikasi WhatsApp |
| `NEXT_PUBLIC_APP_URL` | production | Base URL untuk link WA & metadata |
| `CRON_SECRET` | production | Auth endpoint cron reminder |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | production | Anti-bot form publik |

### Migrasi database

Jalankan file di `supabase/migrations/` **berurutan** (001 → terbaru) lewat SQL Editor Supabase atau Supabase CLI. Migrasi 045 membuat semua bucket Storage yang dibutuhkan; 046 menambah kolom revoke sesi.

## Script

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Build production |
| `npm run start` | Jalankan hasil build |
| `npm run lint` | ESLint |
| `npm run check` | Typecheck + ESLint |
| `npm run seed:demo` | Seed data demo (butuh `.env.local`) |

## Deploy (Vercel)

1. Set semua env production di dashboard Vercel.
2. Apply seluruh migrasi ke Supabase production.
3. Pastikan bucket Storage sudah ada (migrasi 045) dan `public = true`.
4. Deploy. Cron di `vercel.json` memanggil endpoint `/api/cron/*` dan memerlukan `CRON_SECRET`.
5. Uji alur publik: daftar tenant → tiket → PO → paket combo → upload bukti → verifikasi admin → scan QR.

## Struktur singkat

- `src/app/(public pages)` — halaman publik: `beli-tiket`, `daftar-tenant`, `merchandise`, `paket`, `lacak`, `tiket-saya`, `tenant-info`.
- `src/app/dankelola` — dashboard admin (PIN + sesi cookie).
- `src/app/api` — route handler API (publik, admin, cron).
- `src/lib` — query Supabase, aturan harga, notifikasi WA, PDF, token link, tipe.
- `supabase/migrations` — skema database & storage.
