'use client'

import { DataError } from '@/components/data-error'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, Eye, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { useIsViewer } from '@/lib/dashboard-user'
import { PageSkeleton } from '../../ui'
import { useConfirm } from '@/components/confirm-dialog'
import type { KategoriSewa, KategoriBundleDiscount, HargaDasar, PeriodeHarga } from '@/lib/types'
import { periodeDariTanggal } from '@/lib/types'
import { kategoriTenant } from '@/lib/tenant'
import { formatRupiah, todayISO } from '@/lib/utils'

type Master = { kategori: KategoriSewa[]; hargaDasar: HargaDasar[]; periode: PeriodeHarga[] }

export default function HargaPage() {
  const confirm = useConfirm()
  const isViewer = useIsViewer()
  const [kategori, setKategori] = useState<KategoriSewa[]>([])
  const [hargaDasar, setHargaDasar] = useState<HargaDasar[]>([])
  const [bundles, setBundles] = useState<KategoriBundleDiscount[]>([])
  const [periods, setPeriods] = useState<PeriodeHarga[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const allSelected = kategori.length > 0 && kategori.every((k) => selected.has(k.id))

  const load = useCallback(async () => {
    const [m, b] = await Promise.all([
      getJSON<Master>('/api/master'),
      getJSON<KategoriBundleDiscount[]>('/api/tenant/bundle').catch(() => []),
    ])
    setKategori(kategoriTenant(m.kategori || [], true))
    setHargaDasar(m.hargaDasar || [])
    setPeriods(m.periode || [])
    setBundles(b || [])
  }, [])

  useEffect(() => {
    load()
      .catch((e) => {
        console.error('Failed to load master data:', e)
        setError('Gagal memuat data master')
      })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  const activeKode = periodeDariTanggal(todayISO(), periods)
  const activePeriod = periods.find((p) => p.kode === activeKode)

  async function hapusPaket(k: KategoriSewa) {
    if (isViewer) return
    const ok = await confirm({
      title: 'Hapus paket tenant?',
      description: `Paket "${k.nama}" beserta harga dan diskon bundle-nya akan dihapus permanen.`,
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      await sendJSON('/api/master/kategori', 'DELETE', { id: k.id })
      toast.success('Paket tenant dihapus')
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function toggleAktif(k: KategoriSewa) {
    if (isViewer) return
    const aktif = k.aktif === false
    setKategori((prev) => prev.map((p) => (p.id === k.id ? { ...p, aktif } : p)))
    try {
      await sendJSON('/api/master/kategori', 'POST', { id: k.id, aktif })
    } catch (e) {
      setKategori((prev) => prev.map((p) => (p.id === k.id ? { ...p, aktif: !aktif } : p)))
      toast.error((e as Error).message)
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  function toggleSelectAll() { setSelected(allSelected ? new Set() : new Set(kategori.map((k) => k.id))) }
  async function hapusTerpilih() {
    if (selected.size === 0) return
    const chosen = kategori.filter((k) => selected.has(k.id))
    const ok = await confirm({ title: `Hapus ${chosen.length} paket terpilih?`, description: 'Semua data terkait akan dihapus permanen.', confirmText: 'Hapus' })
    if (!ok) return
    try {
      await Promise.all(chosen.map((k) => sendJSON('/api/master/kategori', 'DELETE', { id: k.id })))
      toast.success(`${chosen.length} paket dihapus`)
      setSelected(new Set())
      await load()
    } catch (e) { toast.error(String(e)) }
  }

  const hargaPerKategori = useMemo(() => {
    const map = new Map<string, number | null>()
    for (const k of kategori) {
      const h = hargaDasar.find((h) => h.kategori_sewa_id === k.id && h.periode === activeKode && h.jenis_usaha === 'F&B')
        ?? hargaDasar.find((h) => h.kategori_sewa_id === k.id && h.periode === activeKode)
      map.set(k.id, h ? Number(h.harga) : null)
    }
    return map
  }, [kategori, hargaDasar, activeKode])

  const bundlePerKategori = useMemo(() => {
    const map = new Map<string, KategoriBundleDiscount[]>()
    for (const b of bundles) {
      map.set(b.kategori_sewa_id, [...(map.get(b.kategori_sewa_id) ?? []), b])
    }
    return map
  }, [bundles])

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="flex justify-center">
      <DataError title={error} />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Paket & Harga Tenant</h1>
          <p className="text-sm text-slate-500">Kelola paket tenant, periode harga, dan diskon bundle.</p>
        </div>
        {!isViewer && (
          <div className="flex items-center gap-2">
            <Link
              href="/dankelola/tenants/pembayaran"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-primary-200 hover:text-primary-600"
            >
              <CalendarClock className="h-4 w-4" /> Batas Pembayaran
            </Link>
            <Link
              href="/dankelola/tenants/harga/new"
              className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700"
            >
              + Tambah Paket
            </Link>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{selected.size}</span> paket dipilih</p>
          <button type="button" onClick={hapusTerpilih} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700">
            <Trash2 className="h-4 w-4" /> Hapus Terpilih
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-600">
            <tr>
              {!isViewer && <th className="px-4 py-3 w-10"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Pilih semua" className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" /></th>}
              <th className="px-4 py-3">Thumbnail</th>
              <th className="px-4 py-3">Paket</th>
              <th className="px-4 py-3">Diskon Bundle</th>
              <th className="px-4 py-3">Periode Aktif</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {kategori.length === 0 && (
              <tr><td colSpan={isViewer ? 6 : 7} className="px-4 py-12 text-center text-slate-400">Belum ada paket tenant.</td></tr>
            )}
            {kategori.map((k) => {
              const harga = hargaPerKategori.get(k.id)
              const tBundles = bundlePerKategori.get(k.id) ?? []
              const aktif = k.aktif !== false
              return (
                <tr key={k.id} className={`hover:bg-slate-50 ${aktif ? '' : 'opacity-60'}`}>
                  {!isViewer && (
                    <td className="px-4 py-3 align-top"><input type="checkbox" checked={selected.has(k.id)} onChange={() => toggleSelect(k.id)} aria-label={`Pilih ${k.nama}`} className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" /></td>
                  )}
                  <td className="px-4 py-3">
                    <div className="h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      {k.thumbnail_url ? (
                        <img src={k.thumbnail_url} alt={k.nama} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-[10px] text-slate-400">4:5</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{k.nama}</p>
                    {k.keterangan && <p className="mt-0.5 max-w-md text-xs text-slate-500">{k.keterangan}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {tBundles.length === 0 ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {tBundles.map((b) => (
                          <span key={b.id} className="inline-flex items-center rounded-md bg-primary-50 px-1.5 py-0.5 text-xs font-medium text-primary-700">
                            {b.jumlah_min} tenant
                            {Number(b.diskon_nominal) > 0 && ` · ${formatRupiah(Number(b.diskon_nominal))}`}
                            {Number(b.diskon_persen) > 0 && ` · ${Number(b.diskon_persen)}%`}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {harga != null ? (
                      <div>
                        <p className="text-xs font-medium text-slate-700">{activePeriod?.nama ?? 'Periode berjalan'}</p>
                        <p className="font-bold text-primary-600">{formatRupiah(harga)}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Belum diatur</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isViewer ? (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${aktif ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {aktif ? 'Aktif' : 'Nonaktif'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={aktif}
                        onClick={() => toggleAktif(k)}
                        className="group inline-flex items-center"
                        title={aktif ? 'Nonaktifkan paket' : 'Aktifkan paket'}
                      >
                        <span className={`relative h-5 w-9 rounded-full transition-colors ${aktif ? 'bg-green-500' : 'bg-slate-300'}`}>
                          <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${aktif ? 'translate-x-4' : 'translate-x-0'}`} />
                        </span>
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/dankelola/tenants/harga/${k.id}`}
                        className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary-600"
                        title="Detail"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                      {!isViewer && (
                        <>
                          <Link
                            href={`/dankelola/tenants/harga/${k.id}/edit`}
                            className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary-600"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            onClick={() => hapusPaket(k)}
                            className="grid h-7 w-7 place-items-center rounded-lg text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
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
  )
}
