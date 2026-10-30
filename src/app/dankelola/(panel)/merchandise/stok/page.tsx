'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getJSON } from '../../../api'
import { PageSkeleton } from '../../ui'

type StokLog = {
  id: string
  produk: string
  jenis: 'masuk' | 'keluar'
  qty: number
  tanggal: string
  keterangan: string | null
}

// Mock data untuk demo
const MOCK_STOK_LOG: StokLog[] = [
  { id: '1', produk: 'Kaos Dies Natalis', jenis: 'masuk', qty: 50, tanggal: '2026-10-20', keterangan: 'Produksi batch 1' },
  { id: '2', produk: 'Kaos Dies Natalis', jenis: 'keluar', qty: 5, tanggal: '2026-10-21', keterangan: 'Pre-order Ahmad' },
  { id: '3', produk: 'Hoodie Dies Natalis', jenis: 'masuk', qty: 30, tanggal: '2026-10-22', keterangan: 'Produksi batch 2' },
  { id: '4', produk: 'Hoodie Dies Natalis', jenis: 'keluar', qty: 3, tanggal: '2026-10-23', keterangan: 'Pre-order Siti' },
]

export default function StokPage() {
  const [logs, setLogs] = useState<StokLog[]>(MOCK_STOK_LOG)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Simulasi loading
    setTimeout(() => setLoading(false), 500)
  }, [])

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Produksi & Stok</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  const totalMasuk = logs.filter(l => l.jenis === 'masuk').reduce((s, l) => s + l.qty, 0)
  const totalKeluar = logs.filter(l => l.jenis === 'keluar').reduce((s, l) => s + l.qty, 0)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Produksi & Stok</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Masuk</p>
          <p className="text-3xl font-bold text-green-600">{totalMasuk}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Keluar</p>
          <p className="text-3xl font-bold text-red-600">{totalKeluar}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Selisih</p>
          <p className="text-3xl font-bold text-indigo-600">{totalMasuk - totalKeluar}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Tanggal</th>
              <th className="px-3 py-2">Produk</th>
              <th className="px-3 py-2">Jenis</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Keterangan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {logs.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Belum ada log stok.</td></tr>}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-500">{new Date(log.tanggal).toLocaleDateString('id-ID')}</td>
                <td className="px-3 py-2 font-medium">{log.produk}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${log.jenis === 'masuk' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {log.jenis}
                  </span>
                </td>
                <td className="px-3 py-2">{log.qty}</td>
                <td className="px-3 py-2 text-slate-500">{log.keterangan || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}