'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getJSON } from '../../../api'
import { PageSkeleton } from '../../ui'
import type { KategoriSewa, HargaDasar, FaktorHarga } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'

export default function HargaPage() {
  const [kategori, setKategori] = useState<KategoriSewa[]>([])
  const [hargaDasar, setHargaDasar] = useState<HargaDasar[]>([])
  const [faktor, setFaktor] = useState<FaktorHarga[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getJSON<{ kategori: KategoriSewa[]; hargaDasar: HargaDasar[]; faktor: FaktorHarga[] }>('/api/master')
      .then(m => {
        setKategori(m.kategori || [])
        setHargaDasar(m.hargaDasar || [])
        setFaktor(m.faktor || [])
      })
      .catch((e) => {
        console.error('Failed to load master data:', e)
        setError('Gagal memuat data master')
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Paket & Harga</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Paket & Harga</h1>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
        <h2 className="font-semibold mb-4">Kategori Sewa</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Kode</th>
                <th className="px-3 py-2 text-left">Nama</th>
                <th className="px-3 py-2 text-left">Listrik</th>
                <th className="px-3 py-2 text-left">Trashbag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {kategori.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Belum ada kategori sewa.</td></tr>}
              {kategori.map((k) => (
                <tr key={k.id}>
                  <td className="px-3 py-2 font-mono text-xs">{k.kode}</td>
                  <td className="px-3 py-2">{k.nama}</td>
                  <td className="px-3 py-2">{k.include_listrik ? '✓' : '-'}</td>
                  <td className="px-3 py-2">{k.include_trashbag ? '✓' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
        <h2 className="font-semibold mb-4">Harga Dasar</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Kategori</th>
                <th className="px-3 py-2 text-left">Jenis Usaha</th>
                <th className="px-3 py-2 text-left">Periode</th>
                <th className="px-3 py-2 text-right">Harga</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {hargaDasar.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Belum ada harga dasar.</td></tr>}
              {hargaDasar.map((h) => (
                <tr key={h.id}>
                  <td className="px-3 py-2">{kategori.find(k => k.id === h.kategori_sewa_id)?.nama ?? '-'}</td>
                  <td className="px-3 py-2">{h.jenis_usaha}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${h.periode === 'early_bird' ? 'bg-green-100 text-green-800' : h.periode === 'reguler' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                      {h.periode.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{formatRupiah(h.harga)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
        <h2 className="font-semibold mb-4">Faktor Penyesuaian Harga</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Tipe</th>
                <th className="px-3 py-2 text-left">Nilai</th>
                <th className="px-3 py-2 text-right">Multiplier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {faktor.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-400">Belum ada faktor harga.</td></tr>}
              {faktor.map((f) => (
                <tr key={f.id}>
                  <td className="px-3 py-2 capitalize">{f.tipe}</td>
                  <td className="px-3 py-2">{f.nilai}</td>
                  <td className="px-3 py-2 text-right font-mono">{f.multiplier}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}