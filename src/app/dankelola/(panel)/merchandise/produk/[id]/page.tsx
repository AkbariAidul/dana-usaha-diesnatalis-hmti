'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Image as ImageIcon, Pencil } from 'lucide-react'
import { getJSON } from '../../../../api'
import { PageSkeleton } from '../../../ui'
import { useIsViewer } from '@/lib/dashboard-user'
import type { Merchandise } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'

type Varian = { id: string; nama: string }

function formatJadwal(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function ProdukDetailPage() {
  const { id } = useParams<{ id: string }>()
  const isViewer = useIsViewer()
  const [produk, setProduk] = useState<Merchandise | null>(null)
  const [varianList, setVarianList] = useState<Varian[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getJSON<Merchandise[]>('/api/merchandise'),
      getJSON<Varian[]>('/api/merchandise/varian').catch(() => []),
    ])
      .then(([items, varian]) => {
        const found = items.find((item) => item.id === id)
        if (!found) {
          toast.error('Produk tidak ditemukan')
          return
        }
        setProduk(found)
        setVarianList(varian)
      })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <PageSkeleton />
  if (!produk) {
    return (
      <div className="space-y-3">
        <p className="text-red-600">Produk tidak ditemukan.</p>
        <Link href="/dankelola/merchandise/produk" className="text-sm text-primary-600 hover:underline">← Kembali</Link>
      </div>
    )
  }

  const varian = (produk.varian_ids ?? [])
    .map((varianId) => varianList.find((item) => item.id === varianId)?.nama)
    .filter((nama): nama is string => Boolean(nama))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Detail Produk</h1>
          <p className="text-sm text-slate-500">{produk.nama}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dankelola/merchandise/produk" className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Kembali</Link>
          {!isViewer && (
            <Link href={`/dankelola/merchandise/produk/${produk.id}/edit`} className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <div className="grid aspect-[4/5] place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {produk.gambar_url ? (
              <img src={produk.gambar_url} alt={produk.nama} className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-8 w-8 text-slate-300" />
            )}
          </div>
          <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${produk.aktif ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
            {produk.aktif ? 'Aktif' : 'Nonaktif'}
          </span>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">Informasi Produk</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Nama</dt><dd className="font-medium text-slate-900">{produk.nama}</dd></div>
              <div><dt className="text-xs text-slate-500">Warna</dt><dd className="font-medium text-slate-900">{produk.warna || '-'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Deskripsi</dt><dd className="text-slate-700">{produk.deskripsi || '-'}</dd></div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Ukuran Tersedia</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {varian.length === 0 ? <span className="text-slate-400">-</span> : varian.map((nama) => (
                    <span key={nama} className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{nama}</span>
                  ))}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">Harga & Stok</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Harga Hari H</dt><dd className="font-semibold text-primary-600">{Number(produk.harga) > 0 ? formatRupiah(Number(produk.harga)) : 'Tidak dijual Hari H'}</dd></div>
              <div><dt className="text-xs text-slate-500">Stok Hari H</dt><dd className="font-medium text-slate-900">{produk.stok_unlimited ? 'Tak terbatas' : produk.stok}</dd></div>
              <div><dt className="text-xs text-slate-500">Harga Pre-Order</dt><dd className="font-semibold text-primary-600">{produk.harga_po ? formatRupiah(Number(produk.harga_po)) : '-'}</dd></div>
              <div><dt className="text-xs text-slate-500">Slot Pre-Order</dt><dd className="font-medium text-slate-900">{produk.harga_po ? (produk.po_unlimited ? 'Tak terbatas' : produk.po_stok) : '-'}</dd></div>
              <div><dt className="text-xs text-slate-500">Mulai Pre-Order</dt><dd className="text-slate-700">{formatJadwal(produk.po_mulai)}</dd></div>
              <div><dt className="text-xs text-slate-500">Selesai Pre-Order</dt><dd className="text-slate-700">{formatJadwal(produk.po_selesai)}</dd></div>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">Aturan Diskon</h2>
            {!produk.diskon || produk.diskon.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Belum ada aturan diskon.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Minimal Qty</th>
                      <th className="px-3 py-2">Diskon</th>
                      <th className="px-3 py-2">Berlaku</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {produk.diskon.map((rule, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2">{rule.min_qty}+</td>
                        <td className="px-3 py-2 font-medium text-green-600">{rule.tipe === 'persen' ? `${rule.nilai}%` : formatRupiah(rule.nilai)}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {[rule.berlaku_po ? 'Pre-Order' : null, rule.berlaku_hari_h ? 'Hari H' : null].filter(Boolean).join(' & ') || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
