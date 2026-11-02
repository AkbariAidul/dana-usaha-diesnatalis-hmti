'use client'

import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
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

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success('Kode QR disalin')
  } catch {
    toast.error('Gagal menyalin kode QR')
  }
}

function QrThumb({ value }: { value: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let active = true
    QRCode.toDataURL(value, { width: 128, margin: 1 })
      .then((url) => { if (active) setSrc(url) })
      .catch(() => { if (active) setSrc('') })
    return () => { active = false }
  }, [value])

  return (
    <div className="group relative inline-flex h-14 w-14 items-center justify-center">
      {src ? (
        <img src={src} alt={value} className="h-14 w-14 rounded-md border border-slate-200 bg-white" />
      ) : (
        <div className="h-14 w-14 animate-pulse rounded-md bg-slate-100" />
      )}
      <button
        type="button"
        onClick={() => void copyText(value)}
        className="absolute inset-0 flex items-center justify-center rounded-md bg-slate-900/60 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
      >
        Salin
      </button>
    </div>
  )
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

      <div className="overflow-x-auto border-y border-slate-200">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Kode QR</th>
              <th className="px-4 py-3">Kode Tampil</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Digunakan Oleh</th>
              <th className="px-4 py-3">Waktu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {tikets.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Belum ada tiket.</td></tr>}
            {tikets.map((t) => (
              <tr key={t.id} className="transition-colors hover:bg-slate-50">
                <td className="px-4 py-3"><QrThumb value={t.kode_qr} /></td>
                <td className="px-4 py-3 font-mono text-xs">{t.kode_tampil}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${t.status === 'belum_divalidasi' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                    {t.status === 'belum_divalidasi' ? 'Belum Validasi' : 'Sudah Validasi'}
                  </span>
                </td>
                <td className="px-4 py-3">{t.digunakan_oleh || '-'}</td>
                <td className="px-4 py-3 text-slate-500">{t.digunakan_pada ? new Date(t.digunakan_pada).toLocaleString('id-ID') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}