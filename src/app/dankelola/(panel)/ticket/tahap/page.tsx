'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import type { TicketKatalogItem, TicketPeriode, TicketBundleDiscount } from '@/lib/types'
import { formatRupiah, todayISO } from '@/lib/utils'
import { Pencil, Trash2, Eye } from 'lucide-react'
import { useConfirm } from '@/components/confirm-dialog'

function formatTanggal(iso: string) {
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TahapPage() {
  const confirm = useConfirm()
  const [tiket, setTiket] = useState<TicketKatalogItem[]>([])
  const [periods, setPeriods] = useState<TicketPeriode[]>([])
  const [bundles, setBundles] = useState<TicketBundleDiscount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const today = todayISO()

  const load = useCallback(async () => {
    const t = await getJSON<TicketKatalogItem[]>('/api/ticket')
    const [p, b] = await Promise.all([
      getJSON<TicketPeriode[]>('/api/ticket/periode'),
      getJSON<TicketBundleDiscount[]>('/api/ticket/bundle'),
    ])
    setTiket(t)
    setPeriods(p as TicketPeriode[])
    setBundles(b as TicketBundleDiscount[])
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => { setError('Gagal memuat data tiket'); console.error(e) })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  async function hapusTiket(id: string, nama: string) {
    const ok = await confirm({
      title: 'Hapus tipe tiket?',
      description: `Tipe "${nama}" dan semua data terkait akan dihapus permanen.`,
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      await sendJSON('/api/ticket', 'DELETE', { id })
      await load()
      toast.success('Tipe tiket dihapus')
    } catch (e) { toast.error(String(e)) }
  }

  const getActivePeriod = (t: TicketKatalogItem) =>
    periods.find((p) => p.tiket_tipe_id === t.id && today >= p.tanggal_mulai && today <= p.tanggal_selesai) ?? null

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tipe & Harga</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tipe & Harga</h1>
          <p className="text-sm text-slate-500">Kelola tipe tiket, periode harga, dan diskon bundle.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dankelola/ticket/tipe/new" className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">+ Tambah Tipe</Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Nama</th>
              <th className="px-4 py-3 font-medium text-slate-600">Untuk</th>
              <th className="px-4 py-3 font-medium text-slate-600">Harga</th>
              <th className="px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 font-medium text-slate-600">Periode Aktif</th>
              <th className="px-4 py-3 font-medium text-slate-600">Diskon Bundle</th>
              <th className="px-4 py-3 font-medium text-slate-600">Hari H</th>
              <th className="px-4 py-3 font-medium text-slate-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tiket.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  Belum ada tipe tiket.
                  <Link href="/dankelola/ticket/tipe/new" className="block mt-2 text-primary-600 hover:underline">+ Tambah Tipe Pertama</Link>
                </td>
              </tr>
            )}
            {tiket.map((t) => {
              const activePeriod = getActivePeriod(t)
              const tBundles = bundles.filter((b) => b.tiket_tipe_id === t.id)
              return (
                <tr key={t.id} className="group hover:bg-slate-50 transition-colors">
                  {/* Nama */}
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{t.nama}</p>
                  </td>

                  {/* Untuk */}
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <span className="font-medium">{t.jumlah_orang}</span> orang
                    </span>
                  </td>

                  {/* Harga */}
                  <td className="px-4 py-3">
                    <span className="font-bold text-primary-600">{formatRupiah(Number(t.harga_aktif))}</span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.buka
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${t.buka ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {t.buka ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>

                  {/* Periode */}
                  <td className="px-4 py-3">
                    {activePeriod ? (
                      <div className="text-xs">
                        <p className="font-medium text-slate-700">{activePeriod.nama || 'Periode'}</p>
                        <p className="text-slate-500">{formatTanggal(activePeriod.tanggal_mulai)} – {formatTanggal(activePeriod.tanggal_selesai)}</p>
                        <p className="font-medium text-primary-600">{formatRupiah(Number(activePeriod.harga))}</p>
                      </div>
                    ) : periods.some((p) => p.tiket_tipe_id === t.id) ? (
                      <span className="text-xs text-slate-400">Tidak ada periode aktif</span>
                    ) : (
                      <span className="text-xs text-slate-400">Harga dasar {formatRupiah(Number(t.harga))}</span>
                    )}
                  </td>

                  {/* Bundle */}
                  <td className="px-4 py-3">
                    {tBundles.length === 0 ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {tBundles.map((b) => (
                          <span key={b.id} className="inline-flex items-center rounded-md bg-primary-50 px-1.5 py-0.5 text-xs font-medium text-primary-700">
                            {b.jumlah_min} → {b.diskon_persen}%
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Hari H */}
                  <td className="px-4 py-3">
                    {t.is_hari_h ? (
                      <div className="text-xs">
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-orange-600">{t.terjual ?? 0}</span>
                          <span className="text-slate-400">/ {t.kuota}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-16 rounded-full bg-orange-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-orange-500 transition-all"
                            style={{ width: `${Math.min(100, Math.round(((t.terjual ?? 0) / t.kuota) * 100))}%` }}
                          />
                        </div>
                        <p className="text-slate-400 mt-0.5">Sisa {t.sisa ?? 0}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>

                  {/* Aksi */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/dankelola/ticket/tipe/${t.id}`}
                        className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-primary-600 transition-colors"
                        title="Detail"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        href={`/dankelola/ticket/tipe/${t.id}/edit`}
                        className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-primary-600 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={() => hapusTiket(t.id, t.nama)}
                        className="grid h-7 w-7 place-items-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
