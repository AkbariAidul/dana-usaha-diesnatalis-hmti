'use client'

import { useCallback, useEffect, useState } from 'react'
import { Inbox, Ticket } from 'lucide-react'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { PageSkeleton } from '../../ui'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { formatRupiah } from '@/lib/utils'
import type { PesananTiket } from '@/lib/types'

const STATUS: Record<PesananTiket['status'], { label: string; className: string; dot: string }> = {
  menunggu_verifikasi: { label: 'Menunggu', className: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  lunas: { label: 'Lunas', className: 'bg-green-50 text-green-700 ring-green-200', dot: 'bg-green-500' },
  ditolak: { label: 'Ditolak', className: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
  batal: { label: 'Batal', className: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
}

export default function PenjualanPage() {
  const [pesanan, setPesanan] = useState<PesananTiket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

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

  async function verifikasi(id: string, status: 'lunas' | 'ditolak') {
    setBusyId(id)
    try {
      await sendJSON('/api/ticket/verification', 'POST', { id, status, catatan_admin: null })
      toast.success(status === 'lunas' ? 'Pesanan diverifikasi' : 'Pesanan ditolak')
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

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

  const totalTiket = pesanan
    .filter((p) => p.status === 'lunas')
    .reduce((s, p) => s + Number(p.jumlah), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Penjualan Tiket</h1>
          <p className="text-sm text-slate-500">Ringkasan modal, harga jual, dan keuntungan dari semua tipe & periode.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          <Ticket className="h-4 w-4 text-primary-500" />
          <span className="font-semibold text-slate-900">{totalTiket}</span> tiket terjual
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">No. Pesanan</th>
                <th className="px-5 py-3">Pembeli</th>
                <th className="px-5 py-3">Kontak</th>
                <th className="px-5 py-3">Tiket</th>
                <th className="px-5 py-3">Periode</th>
                <th className="px-5 py-3 text-right">Jumlah</th>
                <th className="px-5 py-3 text-right">Harga Jual</th>
                <th className="px-5 py-3 text-right">Modal</th>
                <th className="px-5 py-3 text-right">Keuntungan</th>
                <th className="px-5 py-3">Bukti</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {pesanan.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center">
                    <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    <p className="text-sm text-slate-400">Belum ada penjualan.</p>
                  </td>
                </tr>
              )}
              {pesanan.map((p) => {
                const status = STATUS[p.status]
                return (
                  <tr key={p.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.no_pesanan}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-50 text-[11px] font-semibold text-primary-700">
                          {p.nama_pembeli.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-medium text-slate-900">{p.nama_pembeli}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-slate-700">{p.kontak}</p>
                      {p.email && <p className="text-xs text-slate-400">{p.email}</p>}
                    </td>
                    <td className="px-5 py-3 text-slate-700">{p.tiket_nama || '-'}</td>
                    <td className="px-5 py-3 text-slate-500">{p.periode_nama || 'Harga dasar'}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700">{p.jumlah}</td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-slate-900">{formatRupiah(Number(p.total))}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-orange-600">{formatRupiah(Number(p.modal_total))}</td>
                    <td className={`px-5 py-3 text-right font-semibold tabular-nums ${Number(p.keuntungan) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatRupiah(Number(p.keuntungan))}
                    </td>
                    <td className="px-5 py-3">
                      {p.bukti_url ? (
                        <a href={p.bukti_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary-600 hover:underline">
                          Lihat
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {p.status === 'menunggu_verifikasi' ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => verifikasi(p.id, 'lunas')}
                            disabled={busyId === p.id}
                            className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
                          >
                            Verifikasi
                          </button>
                          <button
                            onClick={() => verifikasi(p.id, 'ditolak')}
                            disabled={busyId === p.id}
                            className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                          >
                            Tolak
                          </button>
                        </div>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${status.className}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
