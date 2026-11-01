'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../api'
import { TableSkeleton, PageSkeleton } from '../ui'
import type { Tenant } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'

type Pemasukan = {
  id: string
  nama_usaha: string
  nominal: number
  tgl_transaksi: string
  keterangan: string | null
  metode: string | null
  created_at: string
}

type Pengeluaran = {
  id: string
  nama: string
  nominal: number
  tgl_transaksi: string
  keterangan: string | null
  metode: string | null
  created_at: string
}

export default function KeuanganPage() {
  const [pemasukan, setPemasukan] = useState<Pemasukan[]>([])
  const [pengeluaran, setPengeluaran] = useState<Pengeluaran[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // error state available

  useEffect(() => {
    // Mock data untuk demo karena API belum tersedia
    const mockPemasukan: Pemasukan[] = [
      { id: '1', nama_usaha: 'KT-01 - Warung Bakso', nominal: 450000, tgl_transaksi: '2026-10-25', keterangan: 'DP Tenant', metode: 'QRIS', created_at: '2026-10-25' },
      { id: '2', nama_usaha: 'KT-02 - Toko Elektronik', nominal: 900000, tgl_transaksi: '2026-10-26', keterangan: 'Pelunasan', metode: 'Transfer', created_at: '2026-10-26' },
    ]
    const mockPengeluaran: Pengeluaran[] = [
      { id: '1', nama: 'Sewa Tempat', nominal: 500000, tgl_transaksi: '2026-10-20', keterangan: 'Bayar sewa venue', metode: 'Transfer', created_at: '2026-10-20' },
    ]
    setTimeout(() => {
      setPemasukan(mockPemasukan)
      setPengeluaran(mockPengeluaran)
      setLoading(false)
    }, 500)
  }, [])

  const totalMasuk = pemasukan.reduce((s, p) => s + p.nominal, 0)
  const totalKeluar = pengeluaran.reduce((s, pg) => s + pg.nominal, 0)
  const sisa = totalMasuk - totalKeluar

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Keuangan Dana Usaha</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Keuangan Dana Usaha</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Masuk</p>
          <p className="text-3xl font-bold text-primary-600">{formatRupiah(totalMasuk)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Keluar</p>
          <p className="text-3xl font-bold text-red-600">{formatRupiah(totalKeluar)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Sisa</p>
          <p className="text-3xl font-bold {sisa >= 0 ? 'text-green-600' : 'text-orange-600'}">
            {formatRupiah(sisa)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Jumlah Pemasukan</p>
          <p className="text-lg font-medium">{pemasukan.length} transaksi</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Jumlah Pengeluaran</p>
          <p className="text-lg font-medium">{pengeluaran.length} transaksi</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Tanggal</th>
              <th className="px-3 py-2">Keterangan</th>
              <th className="px-3 py-2">Jenis</th>
              <th className="px-3 py-2 nominal">Nominal</th>
              <th className="px-3 py-2">Metode</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {loading && <TableSkeleton rows={6} cols={5} />}
            {!loading && pemasukan.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Belum ada pemasukan.</td></tr>}
            {!loading && pemasukan.length > 0 && pemasukan.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-500">{new Date(p.tgl_transaksi).toLocaleDateString('id-ID')}</td>
                <td className="px-3 py-2">{p.nama_usaha}</td>
                <td className="px-3 py-2">Pemasukan</td>
                <td className="px-3 py-2 font-medium text-primary-600">{formatRupiah(p.nominal)}</td>
                <td className="px-3 py-2">{p.metode || '-'}</td>
              </tr>
            ))}
            {!loading && pengeluaran.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Belum ada pengeluaran.</td></tr>}
            {!loading && pengeluaran.length > 0 && pengeluaran.map((pg) => (
              <tr key={pg.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-500">{new Date(pg.tgl_transaksi).toLocaleDateString('id-ID')}</td>
                <td className="px-3 py-2">{pg.nama}</td>
                <td className="px-3 py-2">Pengeluaran</td>
                <td className="px-3 py-2 font-medium text-red-600">{formatRupiah(pg.nominal)}</td>
                <td className="px-3 py-2">{pg.metode || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}