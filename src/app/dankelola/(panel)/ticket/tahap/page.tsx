'use client'

import { DataError } from '@/components/data-error'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import type { TicketKatalogItem, TicketPeriode, TicketBundleDiscount } from '@/lib/types'
import { formatRupiah, todayISO } from '@/lib/utils'
import { Pencil, Trash2, Eye, Wallet } from 'lucide-react'
import { useConfirm } from '@/components/confirm-dialog'
import { useIsViewer } from '@/lib/dashboard-user'

function formatTanggal(iso: string) {
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TahapPage() {
  const confirm = useConfirm()
  const isViewer = useIsViewer()
  const [tiket, setTiket] = useState<TicketKatalogItem[]>([])
  const [periods, setPeriods] = useState<TicketPeriode[]>([])
  const [bundles, setBundles] = useState<TicketBundleDiscount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const allSelected = tiket.length > 0 && tiket.every((t) => selected.has(t.id))
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

  async function toggleAktif(t: TicketKatalogItem) {
    if (togglingId) return
    setTogglingId(t.id)
    try {
      await sendJSON('/api/ticket', 'POST', { id: t.id, aktif: !t.aktif })
      await load()
      toast.success(t.aktif ? 'Tiket dinonaktifkan' : 'Tiket diaktifkan')
    } catch (e) { toast.error(String(e)) }
    finally { setTogglingId(null) }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  function toggleSelectAll() { setSelected(allSelected ? new Set() : new Set(tiket.map((t) => t.id))) }
  async function hapusTerpilih() {
    if (selected.size === 0) return
    const chosen = tiket.filter((t) => selected.has(t.id))
    const ok = await confirm({ title: `Hapus ${chosen.length} tipe tiket terpilih?`, description: 'Semua data terkait akan dihapus permanen.', confirmText: 'Hapus' })
    if (!ok) return
    try {
      await Promise.all(chosen.map((t) => sendJSON('/api/ticket', 'DELETE', { id: t.id })))
      toast.success(`${chosen.length} tipe tiket dihapus`)
      setSelected(new Set())
      await load()
    } catch (e) { toast.error(String(e)) }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="flex justify-center">
      <DataError title={error} />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tipe & Harga</h1>
          <p className="text-sm text-slate-500">Kelola tipe tiket, periode harga, dan diskon bundle.</p>
        </div>
        {!isViewer && (
          <div className="flex items-center gap-2">
            <Link href="/dankelola/ticket/modal" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-primary-200 hover:text-primary-600">
              <Wallet className="h-4 w-4" /> Kelola Modal
            </Link>
            <Link href="/dankelola/ticket/tipe/new" className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">+ Tambah Tipe</Link>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{selected.size}</span> tipe tiket dipilih</p>
          <button type="button" onClick={hapusTerpilih} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700">
            <Trash2 className="h-4 w-4" /> Hapus Terpilih
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-slate-50 text-left border-b border-slate-200">
            <tr>
              {!isViewer && <th className="px-4 py-3 w-10"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Pilih semua" className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" /></th>}
              <th className="px-4 py-3 font-medium text-slate-600">Thumbnail</th>
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
                <td colSpan={isViewer ? 9 : 10} className="px-4 py-12 text-center text-slate-400">
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
                  {!isViewer && (
                    <td className="px-4 py-3 align-top">
                      <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)} aria-label={`Pilih ${t.nama}`} className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                    </td>
                  )}
                  {/* Thumbnail */}
                  <td className="px-4 py-3">
                    {t.thumbnail_url ? (
                      <img
                        src={t.thumbnail_url}
                        alt={t.nama}
                        className="h-16 w-[52px] rounded-lg border border-slate-200 object-cover"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>

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
                    {isViewer ? (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${t.aktif ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {t.aktif ? 'Aktif' : 'Nonaktif'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={t.aktif}
                        disabled={togglingId === t.id}
                        onClick={() => toggleAktif(t)}
                        className={`inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors disabled:opacity-50 ${t.aktif ? 'bg-primary-600' : 'bg-slate-300'}`}
                        title={t.aktif ? 'Nonaktifkan tiket' : 'Aktifkan tiket'}
                      >
                        <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${t.aktif ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    )}
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
                      {!isViewer && (
                        <>
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
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
