'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Search, ArrowLeft } from 'lucide-react'

export default function LacakPage() {
  const router = useRouter()
  const [kode, setKode] = useState('')
  const [kontak, setKontak] = useState('')
  const [loading, setLoading] = useState(false)

  async function cari(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/public/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kode, kontak }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Data tidak ditemukan')
      router.push(data.redirect)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <header className="border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-sm font-semibold text-white">DU</span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Lacak Pesanan</p>
              <p className="text-xs text-slate-500">Dies Natalis HMTI</p>
            </div>
          </Link>
          <Link href="/" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <div className="mb-6">
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-indigo-600/10 text-indigo-600">
              <Search className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900">Cek Status & Riwayat</h1>
            <p className="mt-1 text-sm text-slate-500">
              Masukkan kode dan kontak yang dipakai saat mendaftar. Tanpa login.
            </p>
          </div>

          <form onSubmit={cari} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Kode</label>
              <input
                value={kode}
                onChange={(e) => setKode(e.target.value.toUpperCase())}
                placeholder="TP-0001 / TK-0001 / PO-0001"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm uppercase focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Kontak / Email</label>
              <input
                value={kontak}
                onChange={(e) => setKontak(e.target.value)}
                placeholder="08xxxxxxxxxx atau email"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !kode || !kontak}
              className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? 'Mencari...' : 'Lihat Riwayat'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
