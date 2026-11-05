'use client'

import { DataError } from '@/components/data-error'

import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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
  nomor: number
  total: number
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
  const [validators, setValidators] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [validatorFilter, setValidatorFilter] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    const [data, users] = await Promise.all([
      getJSON<TiketIssued[]>('/api/ticket/checkin'),
      getJSON<{ name: string }[]>('/api/auth/users').catch(() => []),
    ])
    setTikets(data)
    setValidators(
      Array.from(
        new Set([
          ...users.map((user) => user.name),
          ...data.map((t) => t.digunakan_oleh).filter((v): v is string => Boolean(v)),
        ])
      ).sort()
    )
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

  useEffect(() => {
    setPage(1)
  }, [validatorFilter])

  const PER_PAGE = 10
  const filtered = validatorFilter
    ? tikets.filter((t) => t.digunakan_oleh === validatorFilter)
    : tikets
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Check-in</h1>
      <DataError title={error} />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Check-in</h1>
          <p className="text-sm text-slate-500">Daftar tiket dan status validasinya.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs font-medium text-slate-500">Divalidasi oleh</span>
          <select
            value={validatorFilter}
            onChange={(e) => setValidatorFilter(e.target.value)}
            aria-label="Filter divalidasi oleh"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100 sm:w-auto"
          >
            <option value="">Semua petugas</option>
            {validators.map((validator) => (
              <option key={validator} value={validator}>{validator}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden border-y border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Kode QR</th>
                <th className="px-4 py-3">Kode Tampil / Tiket</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Divalidasi Oleh</th>
                <th className="px-4 py-3">Waktu Check-in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    {tikets.length === 0 ? 'Belum ada tiket.' : 'Tidak ada tiket yang cocok.'}
                  </td>
                </tr>
              )}
              {paginated.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3"><QrThumb value={t.kode_qr} /></td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">{t.kode_tampil}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">Tiket {t.nomor} dari {t.total}</p>
                  </td>
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
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Menampilkan {filtered.length === 0 ? 0 : (currentPage - 1) * PER_PAGE + 1}–{Math.min(currentPage * PER_PAGE, filtered.length)} dari {filtered.length} tiket
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Halaman sebelumnya"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium text-slate-600">{currentPage} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              aria-label="Halaman berikutnya"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}