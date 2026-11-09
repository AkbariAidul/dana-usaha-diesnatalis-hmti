'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2, ImagePlus } from 'lucide-react'
import { getJSON, sendJSON } from '../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { useConfirm } from '@/components/confirm-dialog'
import { PageSkeleton } from '../ui'
import { DataError } from '@/components/data-error'
import { useIsViewer } from '@/lib/dashboard-user'
import { formatRupiah } from '@/lib/utils'
import type { Bundle, BundleItem, Merchandise, TicketKatalogItem } from '@/lib/types'

export default function PaketPage() {
  const confirm = useConfirm()
  const isViewer = useIsViewer()
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [tiket, setTiket] = useState<TicketKatalogItem[]>([])
  const [merch, setMerch] = useState<Merchandise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [b, t, m] = await Promise.all([
      getJSON<Bundle[]>('/api/paket'),
      getJSON<TicketKatalogItem[]>('/api/ticket'),
      getJSON<Merchandise[]>('/api/merchandise'),
    ])
    setBundles(b)
    setTiket(t)
    setMerch(m)
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => { setError('Gagal memuat data paket'); console.error(e) })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  const tiketMap = useMemo(() => new Map(tiket.map((t) => [t.id, t])), [tiket])
  const merchMap = useMemo(() => new Map(merch.map((m) => [m.id, m])), [merch])

  function namaItem(item: BundleItem) {
    if (item.nama) return item.nama
    return item.tipe === 'tiket' ? tiketMap.get(item.ref_id)?.nama ?? 'Tiket' : merchMap.get(item.ref_id)?.nama ?? 'Merch'
  }

  function hargaItem(item: BundleItem) {
    if (item.harga_satuan != null) return Number(item.harga_satuan)
    if (item.tipe === 'tiket') return Number(tiketMap.get(item.ref_id)?.harga ?? 0)
    const m = merchMap.get(item.ref_id)
    return Number(m?.harga_po_umum ?? m?.harga_po ?? m?.harga ?? 0)
  }

  async function hapus(b: Bundle) {
    const ok = await confirm({
      title: 'Hapus paket?',
      description: `Paket "${b.nama}" akan dihapus permanen.`,
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      await sendJSON('/api/paket', 'DELETE', { id: b.id })
      toast.success('Paket dihapus')
      await load()
    } catch (e) {
      toast.error(String(e))
    }
  }

  if (loading) return <PageSkeleton />
  if (error) return <div className="flex justify-center"><DataError title={error} /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Paket Combo</h1>
          <p className="text-sm text-slate-500">Bundel tiket + merchandise dengan satu pembayaran.</p>
        </div>
        {!isViewer && (
          <Link href="/dankelola/paket/new" className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
            <Plus className="h-4 w-4" /> Tambah Paket
          </Link>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-slate-50 text-left border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">Paket</th>
                <th className="px-4 py-3 font-medium text-slate-600">Isi</th>
                <th className="px-4 py-3 font-medium text-slate-600">Harga</th>
                <th className="px-4 py-3 font-medium text-slate-600">Kuota</th>
                <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 font-medium text-slate-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bundles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    Belum ada paket combo.
                  </td>
                </tr>
              )}
              {bundles.map((b) => {
                const komponen = (b.items ?? []).reduce((sum, i) => sum + hargaItem(i) * Number(i.qty), 0)
                const hargaCoret = Number(b.harga_coret ?? 0) > 0 ? Number(b.harga_coret) : komponen
                return (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {b.gambar_url ? (
                          <img src={b.gambar_url} alt={b.nama} className="h-12 w-12 rounded-lg border border-slate-200 object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-300"><ImagePlus className="h-5 w-5" /></div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-900">{b.nama}</p>
                          {b.deskripsi && <p className="text-xs text-slate-500 line-clamp-1">{b.deskripsi}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ul className="space-y-0.5 text-xs text-slate-600">
                        {(b.items ?? []).map((i) => (
                          <li key={i.id}>{i.qty}× {namaItem(i)} <span className="text-slate-400">({i.tipe === 'tiket' ? 'Tiket' : 'Merch'})</span></li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-primary-600">{formatRupiah(Number(b.harga_bundle))}</p>
                      {hargaCoret > Number(b.harga_bundle) && <p className="text-xs text-slate-400 line-through">{formatRupiah(hargaCoret)}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{Number(b.kuota) > 0 ? Number(b.kuota) : '∞'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${b.aktif ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {b.aktif ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!isViewer && (
                        <div className="flex items-center gap-2">
                          <Link href={`/dankelola/paket/${b.id}/edit`} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-primary-200 hover:text-primary-600" title="Edit"><Pencil className="h-4 w-4" /></Link>
                          <button type="button" onClick={() => hapus(b)} className="rounded-lg border border-slate-200 p-2 text-red-600 hover:border-red-200 hover:bg-red-50" title="Hapus"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
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
