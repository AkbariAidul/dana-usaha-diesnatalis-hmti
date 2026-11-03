'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import { useConfirm } from '@/components/confirm-dialog'
import type { Merchandise } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import { Image as ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react'

function formatJadwal(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
}

export default function ProdukPage() {
  const confirm = useConfirm()
  const [items, setItems] = useState<Merchandise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const data = await getJSON<Merchandise[]>('/api/merchandise')
    setItems(data)
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => {
        console.error('Failed to load merchandise:', e)
        setError('Gagal memuat data produk')
      })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  async function toggle(item: Merchandise) {
    const aktif = !item.aktif
    setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, aktif } : p)))
    try {
      await sendJSON('/api/merchandise', 'POST', { id: item.id, aktif })
    } catch (e) {
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, aktif: item.aktif } : p)))
      toast.error((e as Error).message)
    }
  }

  async function hapus(item: Merchandise) {
    const ok = await confirm({
      title: 'Hapus produk?',
      description: `${item.nama} akan dihapus permanen.`,
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      await sendJSON('/api/merchandise', 'DELETE', { id: item.id })
      toast.success('Produk dihapus')
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Produk & Harga</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Produk & Harga</h1>
          <p className="text-sm text-slate-500">Daftar produk merchandise yang dijual.</p>
        </div>
        <Link
          href="/dankelola/merchandise/produk/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> Tambah Produk
        </Link>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Foto</th>
                <th className="px-5 py-3">Nama</th>
                <th className="px-5 py-3">Deskripsi</th>
                <th className="px-5 py-3 text-right">Harga</th>
                <th className="px-5 py-3 text-right">Stok</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                    Belum ada produk.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-slate-50/70">
                  <td className="px-5 py-3">
                    <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      {item.gambar_url ? (
                        <img src={item.gambar_url} alt={item.nama} className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-slate-300" />
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-900">{item.nama}</td>
                  <td className="max-w-[320px] px-5 py-3 text-slate-500">
                    <span className="line-clamp-2">{item.deskripsi || '-'}</span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    <div className="font-medium text-slate-900">{formatRupiah(Number(item.harga))}</div>
                    {item.harga_po ? <div className="text-xs text-slate-400">PO: {formatRupiah(Number(item.harga_po))}</div> : null}
                    {item.po_mulai && item.po_selesai ? (
                      <div className="text-[11px] text-slate-400">{formatJadwal(item.po_mulai)} – {formatJadwal(item.po_selesai)}</div>
                    ) : null}
                  </td>
                  <td className={`px-5 py-3 text-right font-medium tabular-nums ${item.stok_unlimited || item.stok > 0 ? 'text-slate-700' : 'text-red-600'}`}>
                    {item.stok_unlimited ? 'Tak terbatas' : item.stok}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.aktif}
                      aria-label={item.aktif ? `Nonaktifkan ${item.nama}` : `Aktifkan ${item.nama}`}
                      title={item.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      onClick={() => toggle(item)}
                      className="group inline-flex items-center gap-2"
                    >
                      <span className={`relative h-5 w-9 rounded-full transition-colors ${item.aktif ? 'bg-green-500' : 'bg-slate-300'}`}>
                        <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${item.aktif ? 'translate-x-4' : 'translate-x-0'}`} />
                      </span>
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/dankelola/merchandise/produk/${item.id}/edit`}
                        aria-label={`Edit ${item.nama}`}
                        title="Edit"
                        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => hapus(item)}
                        aria-label={`Hapus ${item.nama}`}
                        title="Hapus"
                        className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
