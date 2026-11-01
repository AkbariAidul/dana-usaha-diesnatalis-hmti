import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { Tent, Shirt, Ticket, LayoutDashboard } from 'lucide-react'

export default async function Home() {
  const token = process.env.DASHBOARD_SESSION_SECRET || (process.env.NODE_ENV !== 'production' ? 'authenticated' : '')
  const authed = !!token && (await cookies()).get('dashboard_session')?.value === token

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50/40">
      <header className="border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <Image src="/logo-dies.png" alt="Logo HIMA TI" width={112} height={37} className="h-auto w-20 sm:w-28 rounded-lg" />
            <h1 className="text-lg font-semibold text-slate-900">Dana Usaha HMTI</h1>
          </div>
          <div className="flex items-center gap-2">
            <nav className="hidden md:flex items-center gap-2 text-sm">
              <Link href="/lacak" className="rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-100">Lacak Pesanan</Link>
              <Link href="/tenant-info" className="rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-100">Info Tenant</Link>
              <Link href="/merchandise" className="rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-100">Merchandise</Link>
              <Link href="/ticket" className="rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-100">Ticket</Link>
            </nav>
            {authed && (
              <Link href="/dankelola" className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-10 md:mb-12">
          <span className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-600">Dies Natalis HMTI</span>
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight text-slate-900">
            Pendaftaran Publik Dana Usaha
          </h2>
          <p className="mt-3 text-slate-500 text-base md:text-lg">
            Daftar Tenant, Pre-Order Merchandise, atau Beli Tiket langsung dari sini.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-6">
          <Link href="/daftar-tenant" className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary-100/60">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary-50" />
            <div className="relative">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-primary-600/10 text-primary-600">
                <Tent className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Daftar Tenant</h3>
              <p className="mt-1 text-sm text-slate-500">Pilih kategori, hitung harga otomatis, bayar via QRIS & upload bukti.</p>
              <span className="mt-4 inline-flex text-sm font-medium text-primary-600">Mulai Daftar →</span>
            </div>
          </Link>

          <Link href="/po-merchandise" className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary-100/60">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-violet-50" />
            <div className="relative">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-violet-600/10 text-violet-600">
                <Shirt className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">PO Merchandise</h3>
              <p className="mt-1 text-sm text-slate-500">Pre-order baju Dies Natalis khusus Pengurus Himpunan & Umum.</p>
              <span className="mt-4 inline-flex text-sm font-medium text-violet-600">Pesan Sekarang →</span>
            </div>
          </Link>

          <Link href="/beli-tiket" className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary-100/60">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-50" />
            <div className="relative">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-emerald-600/10 text-emerald-600">
                <Ticket className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Beli Tiket</h3>
              <p className="mt-1 text-sm text-slate-500">Pilih tipe tiket, bayar QRIS, dapat QR unik untuk check-in hari H.</p>
              <span className="mt-4 inline-flex text-sm font-medium text-emerald-600">Beli Tiket →</span>
            </div>
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500">
          <Link href="/tenant-info" className="hover:text-slate-900">Info Tenant</Link>
          <span>•</span>
          <Link href="/merchandise" className="hover:text-slate-900">Katalog Merchandise</Link>
          <span>•</span>
          <Link href="/ticket" className="hover:text-slate-900">Info Ticket</Link>
        </div>
      </main>
    </div>
  )
}
