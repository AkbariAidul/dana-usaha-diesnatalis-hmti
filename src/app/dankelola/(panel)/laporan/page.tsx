'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Tenant } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import { STATUS_LABEL } from '@/lib/types'
import { getJSON } from '../../api'
import { PageSkeleton } from '../ui'

export default function LaporanPage() {
  const [data, setData] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getJSON<Tenant[]>('/api/tenants').then(setData).catch((e) => toast.error(e.message)).finally(() => setLoading(false))
  }, [])

  const aktif = data.filter((t) => t.status !== 'batal')
  const totalTagihan = aktif.reduce((s, t) => s + t.harga_akhir, 0)
  const totalMasuk = aktif.reduce((s, t) => s + t.sudah_dibayar, 0)

  function exportCSV() {
    const header = ['Kode', 'Nama Usaha', 'Kategori', 'Jenis', 'Asal', 'Lokasi', 'Harga', 'DP', 'Dibayar', 'Sisa', 'Status', 'Tgl Daftar']
    const rows = aktif.map((t) => [
      t.kode_stand, t.nama_usaha, t.kategori_sewa?.nama ?? '', t.jenis_usaha, t.asal, t.lokasi,
      t.harga_akhir, t.dp_wajib, t.sudah_dibayar, t.harga_akhir - t.sudah_dibayar, STATUS_LABEL[t.status], t.tgl_daftar,
    ])
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `laporan-tenant-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Laporan</h1>
        <button onClick={exportCSV} className="bg-indigo-600 text-white px-6 py-2.5.5 rounded-xl font-medium transition-all hover:bg-indigo-700 hover:shadow-sm hover:shadow-indigo-600/20 text-sm hover:bg-indigo-700">Export CSV</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Tenant Aktif', String(aktif.length), 'text-indigo-600'],
          ['Total Tagihan', formatRupiah(totalTagihan), 'text-slate-900'],
          ['Total Masuk', formatRupiah(totalMasuk), 'text-green-600'],
          ['Piutang', formatRupiah(totalTagihan - totalMasuk), 'text-orange-600'],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
            <p className="text-sm text-slate-500">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr><th className="px-3 py-2">Kode</th><th className="px-3 py-2">Nama</th><th className="px-3 py-2">Kategori</th><th className="px-3 py-2">Harga</th><th className="px-3 py-2">Dibayar</th><th className="px-3 py-2">Sisa</th><th className="px-3 py-2">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {aktif.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Belum ada data.</td></tr>}
            {aktif.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs">{t.kode_stand}</td>
                <td className="px-3 py-2">{t.nama_usaha}</td>
                <td className="px-3 py-2">{t.kategori_sewa?.nama ?? '-'}</td>
                <td className="px-3 py-2">{formatRupiah(t.harga_akhir)}</td>
                <td className="px-3 py-2">{formatRupiah(t.sudah_dibayar)}</td>
                <td className="px-3 py-2 text-orange-600">{formatRupiah(t.harga_akhir - t.sudah_dibayar)}</td>
                <td className="px-3 py-2">{STATUS_LABEL[t.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
