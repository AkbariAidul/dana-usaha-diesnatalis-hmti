'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { getJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import type { Merchandise } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'

function jadwalStatus(item: Merchandise) {
  if (!item.harga_po || !item.po_mulai || !item.po_selesai) {
    return { label: 'Belum diatur', className: 'bg-slate-100 text-slate-500' }
  }
  const now = Date.now()
  const mulai = new Date(item.po_mulai).getTime()
  const selesai = new Date(item.po_selesai).getTime()
  if (now < mulai) return { label: 'Dijadwalkan', className: 'bg-blue-100 text-blue-700' }
  if (now > selesai) return { label: 'Berakhir', className: 'bg-slate-100 text-slate-500' }
  return { label: 'Berlangsung', className: 'bg-green-100 text-green-700' }
}

export default function JadwalPoPage() {
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
        console.error('Failed to load jadwal PO:', e)
        setError('Gagal memuat jadwal PO')
      })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Jadwal PO</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Jadwal PO</h1>
          <p className="text-sm text-slate-500">Atur rentang tanggal pre-order. Harga dan slot mengikuti Produk &amp; Harga.</p>
        </div>
        <Link href="/dankelola/merchandise/preorder" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
          Kembali ke Pre-Order
        </Link>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Produk</th>
                <th className="px-5 py-3">Mulai</th>
                <th className="px-5 py-3">Selesai</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">
                    Belum ada produk. Tambahkan produk di menu Produk & Harga.
                  </td>
                </tr>
              )}
              {items.map((item) => {
                const status = jadwalStatus(item)
                return (
                  <tr key={item.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{item.nama}</div>
                      {!item.aktif && <div className="text-xs text-slate-400">Produk nonaktif</div>}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{item.po_mulai ? formatDateTime(item.po_mulai) : '-'}</td>
                    <td className="px-5 py-3 text-slate-600">{item.po_selesai ? formatDateTime(item.po_selesai) : '-'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <Link
                          href={`/dankelola/merchandise/jadwal/${item.id}/edit`}
                          aria-label={`Atur jadwal ${item.nama}`}
                          title="Atur jadwal"
                          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </div>
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
