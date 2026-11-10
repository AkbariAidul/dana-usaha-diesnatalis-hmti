'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, Send } from 'lucide-react'
import { getJSON, sendJSON } from '../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { TableSkeleton } from '../ui'

type WaRow = {
  id: string
  target: string
  message: string
  ref_type: string | null
  ref_id: string | null
  status: 'pending' | 'sent' | 'failed'
  attempts: number
  last_error: string | null
  next_retry_at: string
  created_at: string
  sent_at: string | null
}

const control = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10'

const STATUS_STYLE: Record<WaRow['status'], string> = {
  pending: 'bg-amber-50 text-amber-700',
  sent: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
}

function formatWaktu(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function NotifikasiPage() {
  const [data, setData] = useState<WaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const qs = status ? `?status=${status}` : ''
    setData(await getJSON<WaRow[]>(`/api/notifikasi${qs}`))
  }, [status])

  useEffect(() => {
    setLoading(true)
    load().catch((e) => toast.error(e.message)).finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  const summary = useMemo(() => {
    return {
      total: data.length,
      pending: data.filter((r) => r.status === 'pending').length,
      failed: data.filter((r) => r.status === 'failed').length,
      sent: data.filter((r) => r.status === 'sent').length,
    }
  }, [data])

  async function retry(row: WaRow) {
    setBusy(row.id)
    try {
      await sendJSON('/api/notifikasi', 'POST', { id: row.id })
      await load()
      toast.success('Pesan dicoba ulang')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengirim ulang')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Notifikasi WhatsApp</h1>
          <p className="mt-1 text-sm text-slate-500">Pesan yang gagal terkirim otomatis dicoba ulang oleh cron setiap 10 menit.</p>
        </div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {summary.total} pesan · {summary.pending} antre · {summary.failed} gagal
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm shadow-slate-200/40">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500">Status</span>
          <select className={`${control} w-40`} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua status</option>
            <option value="pending">Antre</option>
            <option value="failed">Gagal</option>
            <option value="sent">Terkirim</option>
          </select>
        </label>
        <button
          onClick={() => load().catch((e) => toast.error(e.message))}
          className="flex h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Muat ulang
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2.5">Dibuat</th>
              <th className="px-3 py-2.5">Tujuan</th>
              <th className="px-3 py-2.5">Pesan</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Percobaan</th>
              <th className="px-3 py-2.5">Error</th>
              <th className="px-3 py-2.5">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {loading && <TableSkeleton rows={6} cols={7} />}
            {!loading && data.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Belum ada pesan di antrean.</td></tr>
            )}
            {data.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/80">
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">{formatWaktu(row.created_at)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-700">{row.target}</td>
                <td className="max-w-[320px] px-3 py-2.5 text-xs text-slate-600">
                  <span className="line-clamp-2" title={row.message}>{row.message}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-md px-2 py-1 text-[11px] font-medium ${STATUS_STYLE[row.status]}`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-500">{row.attempts}</td>
                <td className="px-3 py-2.5 text-xs text-red-600">{row.last_error ?? '-'}</td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => retry(row)}
                    disabled={busy === row.id}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {busy === row.id ? 'Mengirim...' : 'Kirim ulang'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
