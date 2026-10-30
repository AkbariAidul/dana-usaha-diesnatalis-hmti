'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getJSON } from '../../../api'
import { PageSkeleton } from '../../ui'

type PesananTiket = {
  id: string
  no_pesanan: string
  nama_pembeli: string
  kontak: string
  tiket_nama: string
  jumlah: number
  total: number
  status: 'menunggu_verifikasi' | 'lunas' | 'ditolak' | 'batal'
  created_at: string
}

// Mock data untuk demo
const MOCK_PESANAN: PesananTiket[] = [
  { id: '1', no_pesanan: 'TK-0001', nama_pembeli: 'Ahmad Fauzi', kontak: '081234567890', tiket_nama: 'VIP Pass', jumlah: 1, total: 150000, status: 'menunggu_verifikasi', created_at: '2026-10-30' },
  { id: '2', no_pesanan: 'TK-0002', nama_pembeli: 'Siti Aminah', kontak: '081234567891', tiket_nama: 'Regular Pass', jumlah: 2, total: 100000, status: 'lunas', created_at: '2026-10-29' },
  { id: '3', no_pesanan: 'TK-0003', nama_pembeli: 'Budi Santoso', kontak: '081234567892', tiket_nama: 'VIP Pass', jumlah: 1, total: 150000, status: 'ditolak', created_at: '2026-10-28' },
]

export default function PenjualanPage() {
  const [pesanan, setPesanan] = useState<PesananTiket[]>(MOCK_PESANAN)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // error state available

  useEffect(() => {
    // Simulasi loading
    setTimeout(() => setLoading(false), 500)
  }, [])

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

  const menunggu = pesanan.filter(p => p.status === 'menunggu_verifikasi').length
  const lunas = pesanan.filter(p => p.status === 'lunas').length
  const ditolak = pesanan.filter(p => p.status === 'ditolak').length

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Penjualan Tiket</h1>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Pesanan</p>
          <p className="text-3xl font-bold text-indigo-600">{pesanan.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Menunggu Verifikasi</p>
          <p className="text-3xl font-bold text-yellow-600">{menunggu}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Lunas</p>
          <p className="text-3xl font-bold text-green-600">{lunas}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Ditolak</p>
          <p className="text-3xl font-bold text-red-600">{ditolak}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">No. Pesanan</th>
              <th className="px-3 py-2">Pembeli</th>
              <th className="px-3 py-2">Kontak</th>
              <th className="px-3 py-2">Tiket</th>
              <th className="px-3 py-2">Jumlah</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {pesanan.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Belum ada penjualan.</td></tr>}
            {pesanan.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs">{p.no_pesanan}</td>
                <td className="px-3 py-2 font-medium">{p.nama_pembeli}</td>
                <td className="px-3 py-2 text-slate-500">{p.kontak}</td>
                <td className="px-3 py-2">{p.tiket_nama || '-'}</td>
                <td className="px-3 py-2">{p.jumlah}</td>
                <td className="px-3 py-2 font-medium">{p.total.toLocaleString('id-ID')}</td>
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