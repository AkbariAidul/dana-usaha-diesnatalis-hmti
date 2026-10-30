import Link from 'next/link'
import { Shirt, ArrowLeft } from 'lucide-react'

export default function PoMerchandisePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40">
      <header className="border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-sm font-semibold text-white">DU</span>
            <h1 className="text-lg font-semibold text-slate-900">Dana Usaha HMTI</h1>
          </div>
          <nav className="hidden md:flex items-center gap-2 text-sm">
            <Link href="/dankelola" className="rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-100">Ringkasan</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-10 md:mb-12">
          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">Dies Natalis HMTI</span>
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight text-slate-900">PO Merchandise</h2>
          <p className="mt-3 text-slate-500 text-base md:text-lg">Pre-order baju Dies Natalis khusus Pengurus Himpunan & Umum.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-6">
          <Link href="/dankelola/merchandise/produk" className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-100/60">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-violet-50" />
            <div className="relative">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-violet-600/10 text-violet-600">
                <Shirt className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Katalog Merchandise</h3>
              <p className="mt-1 text-sm text-slate-500">Lihat semua produk merchandise tersedia.</p>
              <span className="mt-4 inline-flex text-sm font-medium text-violet-600">Lihat Produk →</span>
            </div>
          </Link>

          <Link href="/dankelola/merchandise/preorder" className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-100/60">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-violet-50" />
            <div className="relative">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-violet-600/10 text-violet-600">
                <Shirt className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Pre-Order Baju</h3>
              <p className="mt-1 text-sm text-slate-500">Pre-order baju Dies Natalis khusus Pengurus Himpunan & Umum.</p>
              <span className="mt-4 inline-flex text-sm font-medium text-violet-600">Pesan Sekarang →</span>
            </div>
          </Link>

          <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
            <h3 className="text-lg font-semibold text-slate-900">Info Pembayaran</h3>
            <p className="text-sm text-slate-500">DP 25% dari harga total. Pembayaran melalui QRIS atau transfer bank.</p>
            <p className="mt-2 text-sm text-slate-400">Estimasi pengiriman: 7-14 hari kerja setelah pembayaran lunas.</p>
          </div>
        </div>
      </main>
    </div>
  )
}