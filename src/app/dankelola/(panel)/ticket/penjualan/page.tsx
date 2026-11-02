'use client'

import { useCallback, useEffect, useState } from 'react'
import { getJSON } from '../../../api'
import { PageSkeleton } from '../../ui'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { formatRupiah } from '@/lib/utils'
import type { PesananTiket } from '@/lib/types'

export default function PenjualanPage() {
  const [pesanan, setPesanan] = useState<PesananTiket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const data = await getJSON<PesananTiket[]>('/api/ticket/penjualan')
    setPesanan(data)
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => { setError('Gagal memuat data penjualan'); console.error(e) })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Penjualan Tiket</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  const menunggu = pesanan.filter((p) => p.status === 'menunggu_verifikasi').length
  const lunas = pesanan.filter((p) => p.status === 'lunas')
  const ditolak = pesanan.filter((p) => p.status === 'ditolak').length
  const totalPenjualan = lunas.reduce((s, p) => s + Number(p.total), 0)
  const totalModal = lunas.reduce((s, p) => s + Number(p.modal_total), 0)
  const totalKeuntungan = lunas.reduce((s, p) => s + Number(p.keuntungan), 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Penjualan Tiket</h1>
        <p className="text-sm text-slate-500">Modal, harga jual, dan keuntungan dihitung per pesanan.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Pesanan</p>
          <p className="text-3xl font-bold text-primary-600">{pesanan.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Menunggu Verifikasi</p>
          <p className="text-3xl font-bold text-yellow-600">{menunggu}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Lunas</p>
          <p className="text-3xl font-bold text-green-600">{lunas.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Ditolak</p>
          <p className="text-3xl font-bold text-red-600">{ditolak}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Penjualan Lunas</p>
          <p className="text-2xl font-bold text-slate-900">{formatRupiah(totalPenjualan)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Modal Terpakai</p>
          <p className="text-2xl font-bold text-orange-600">{formatRupiah(totalModal)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Keuntungan</p>
          <p className={`text-2xl font-bold ${totalKeuntungan >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatRupiah(totalKeuntungan)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">No. Pesanan</th>
              <th className="px-3 py-2">Pembeli</th>
              <th className="px-3 py-2">Kontak</th>
              <th className="px-3 py-2">Tiket</th>
              <th className="px-3 py-2">Jumlah</th>
              <th className="px-3 py-2">Harga Jual</th>
              <th className="px-3 py-2">Modal</th>
              <th className="px-3 py-2">Keuntungan</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {pesanan.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">Belum ada penjualan.</td></tr>}
            {pesanan.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs">{p.no_pesanan}</td>
                <td className="px-3 py-2 font-medium">{p.nama_pembeli}</td>
                <td className="px-3 py-2 text-slate-500">{p.kontak}</td>
                <td className="px-3 py-2">{p.tiket_nama || '-'}</td>
                <td className="px-3 py-2">{p.jumlah}</td>
                <td className="px-3 py-2 font-medium">{formatRupiah(Number(p.total))}</td>
                <td className="px-3 py-2 text-orange-600">{formatRupiah(Number(p.modal_total))}</td>
                <td className={`px-3 py-2 font-medium ${Number(p.keuntungan) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatRupiah(Number(p.keuntungan))}
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    p.status === 'menunggu_verifikasi' ? 'bg-yellow-100 text-yellow-800' :
                    p.status === 'lunas' ? 'bg-green-100 text-green-800' :
                    p.status === 'ditolak' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {p.status.replace(/_/g, ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
