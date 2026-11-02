'use client'

import { useCallback, useEffect, useState } from 'react'
import { getJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'

type TiketIssued = {
  id: string
  pesanan_id: string
  kode_qr: string
  kode_tampil: string
  status: 'belum_divalidasi' | 'terpakai'
  digunakan_oleh: string | null
  digunakan_pada: string | null
}

export default function CheckinPage() {
  const [tikets, setTikets] = useState<TiketIssued[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const data = await getJSON<TiketIssued[]>('/api/ticket/checkin')
    setTikets(data)
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => {
        console.error('Failed to load checkin:', e)
        setError('Gagal memuat data tiket')
      })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Check-in</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Check-in</h1>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Kode QR</th>
              <th className="px-3 py-2">Kode Tampil</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Digunakan Oleh</th>
              <th className="px-3 py-2">Waktu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {tikets.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Belum ada tiket.</td></tr>}
            {tikets.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs">{t.kode_qr}</td>
                <td className="px-3 py-2 font-mono text-xs">{t.kode_tampil}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${t.status === 'belum_divalidasi' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                    {t.status === 'belum_divalidasi' ? 'Belum Validasi' : 'Sudah Validasi'}
                  </span>
                </td>
                <td className="px-3 py-2">{t.digunakan_oleh || '-'}</td>
                <td className="px-3 py-2 text-slate-500">{t.digunakan_pada ? new Date(t.digunakan_pada).toLocaleString('id-ID') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}