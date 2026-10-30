'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
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
  const [scanResult, setScanResult] = useState('')

  useEffect(() => {
    getJSON<TiketIssued[]>('/api/ticket/checkin')
      .then(setTikets)
      .catch((e) => {
        console.error('Failed to load checkin:', e)
        setError('Gagal memuat data tiket')
      })
      .finally(() => setLoading(false))
  }, [])

  async function scanQr() {
    const code = scanResult.trim()
    if (!code) return
    const found = tikets.find(t => t.kode_qr === code || t.kode_tampil === code)
    if (!found) {
      toast.error('QR tidak ditemukan')
      return
    }
    if (found.status === 'terpakai') {
      toast.error('QR sudah digunakan')
      return
    }
    try {
      await sendJSON(`/api/ticket/checkin/${found.id}`, 'POST', { dicatat_oleh: 'Admin' })
      toast.success('Check-in berhasil')
      const res = await getJSON<TiketIssued[]>('/api/ticket/checkin')
      setTikets(res)
      setScanResult('')
    } catch (e) { toast.error((e as Error).message) }
  }

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

  const belumDivalidasi = tikets.filter(t => t.status === 'belum_divalidasi').length
  const terpakai = tikets.filter(t => t.status === 'terpakai').length

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Check-in</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Belum Check-in</p>
          <p className="text-3xl font-bold text-yellow-600">{belumDivalidasi}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Sudah Check-in</p>
          <p className="text-3xl font-bold text-green-600">{terpakai}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
        <h2 className="font-semibold mb-4">Scan QR Code</h2>
        <div className="flex gap-3">
          <input
            placeholder="Masukkan kode QR / Scan QR"
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={scanResult}
            onChange={e => setScanResult(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && scanQr()}
          />
          <button onClick={scanQr} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium">Scan</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
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