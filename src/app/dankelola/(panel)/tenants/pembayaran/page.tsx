'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import type { Tenant, Pembayaran } from '@/lib/types'
import { formatRupiah, formatDate } from '@/lib/utils'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'

export default function PembayaranPage() {
  const [pembayaran, setPembayaran] = useState<Pembayaran[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [p, t] = await Promise.all([
      getJSON<Pembayaran[]>('/api/pembayaran'),
      getJSON<Tenant[]>('/api/tenants'),
    ])
    setPembayaran(p)
    setTenants(t)
    setError(null)
  }, [])

  useEffect(() => {
    load().catch((e) => {
      console.error('Failed to load:', e)
      setError('Gagal memuat data pembayaran')
    }).finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  const tenantMap = Object.fromEntries(tenants.map(t => [t.id, t]))

  async function verifikasi(id: string, action: 'approve' | 'reject') {
    try {
      await sendJSON(`/api/pembayaran/${id}`, 'PATCH', { action })
      toast.success(action === 'approve' ? 'Pembayaran diverifikasi' : 'Pembayaran ditolak')
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pembayaran Tenant</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pembayaran Tenant</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Transaksi</p>
          <p className="text-2xl font-bold text-indigo-600">{pembayaran.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Nominal</p>
          <p className="text-2xl font-bold text-green-600">{formatRupiah(pembayaran.reduce((s, p) => s + p.nominal, 0))}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">DP</p>
          <p className="text-2xl font-bold text-yellow-600">{pembayaran.filter(p => p.jenis === 'DP').length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Pelunasan</p>
          <p className="text-2xl font-bold text-blue-600">{pembayaran.filter(p => p.jenis === 'Pelunasan').length}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Tanggal</th>
              <th className="px-3 py-2">Tenant</th>
              <th className="px-3 py-2">Jenis</th>
              <th className="px-3 py-2">Nominal</th>
              <th className="px-3 py-2">Metode</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {pembayaran.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Belum ada pembayaran.</td></tr>}
            {pembayaran.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-500">{formatDate(p.tanggal_bayar)}</td>
                <td className="px-3 py-2">{tenantMap[p.tenant_id]?.nama_usaha ?? '-'}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${p.jenis === 'DP' ? 'bg-yellow-100 text-yellow-800' : p.jenis === 'Cicilan' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                    {p.jenis}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium">{formatRupiah(p.nominal)}</td>
                <td className="px-3 py-2 text-slate-500">{p.metode || '-'}</td>
                <td className="px-3 py-2">
                  {p.validated
                    ? <span className="text-green-600 text-xs">Terverifikasi ✓</span>
                    : <span className="text-orange-600 text-xs">Menunggu</span>}
                </td>
                <td className="px-3 py-2">
                  {!p.validated && (
                    <div className="flex gap-1">
                      <button onClick={() => verifikasi(p.id, 'approve')} className="rounded bg-green-600 px-2 py-1 text-xs text-white">Setujui</button>
                      <button onClick={() => verifikasi(p.id, 'reject')} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Tolak</button>
                    </div>
                  )}
                  {p.bukti_url && <a href={p.bukti_url} target="_blank" rel="noopener noreferrer" className="ml-1 text-xs text-indigo-600 hover:underline">Bukti</a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Link href="/dankelola/tenants" className="text-sm text-indigo-600 hover:underline">← Kembali ke Data Tenant</Link>
    </div>
  )
}