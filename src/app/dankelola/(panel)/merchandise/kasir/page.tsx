'use client'

import { DataError } from '@/components/data-error'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import { BuktiPreviewModal, BuktiThumb } from '@/components/bukti'
import type { MerchModalItem } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import { useIsViewer } from '@/lib/dashboard-user'
import { useConfirm } from '@/components/confirm-dialog'
import { Trash2 } from 'lucide-react'

type KasirTransaksi = {
  id: string
  merchandise_id: string | null
  tanggal: string
  produk: string
  warna: string | null
  lengan: string | null
  qty: number
  total: number
  diskon: number
  metode: string
  dicatat_oleh: string
  bukti_url: string | null
}

export default function KasirPage() {
  const confirm = useConfirm()
  const isViewer = useIsViewer()
  const [transaksi, setTransaksi] = useState<KasirTransaksi[]>([])
  const [modalSatuan, setModalSatuan] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewBukti, setPreviewBukti] = useState<string | null>(null)
  const [selectedKasir, setSelectedKasir] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    const [data, modalItems] = await Promise.all([
      getJSON<KasirTransaksi[]>('/api/merchandise/kasir'),
      getJSON<MerchModalItem[]>('/api/merchandise/modal').catch(() => []),
    ])
    setTransaksi(data)
    setModalSatuan((modalItems ?? []).reduce((sum, item) => sum + Number(item.harga), 0))
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => {
        console.error('Failed to load kasir:', e)
        setError('Gagal memuat data kasir')
      })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  function toggleSelectKasir(id: string) { setSelectedKasir((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n }) }
  function toggleSelectAllKasir() {
    const isAll = transaksi.length > 0 && transaksi.every((t) => selectedKasir.has(t.id))
    setSelectedKasir(isAll ? new Set() : new Set(transaksi.map((t) => t.id)))
  }
  async function hapusTerpilih() {
    if (selectedKasir.size === 0) return
    const ok = await confirm({ title: `Hapus ${selectedKasir.size} transaksi terpilih?`, description: 'Stok produk yang相关 akan dikembalikan.', confirmText: 'Hapus' })
    if (!ok) return
    try {
      await sendJSON('/api/merchandise/kasir', 'DELETE', { ids: [...selectedKasir] })
      toast.success(`${selectedKasir.size} transaksi dihapus`)
      setSelectedKasir(new Set())
      await load()
    } catch (e) { toast.error(String(e)) }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="flex justify-center">
      <DataError title={error} />
    </div>
  )

  const totalHariIni = transaksi.reduce((s, t) => s + t.total, 0)
  const totalModal = transaksi.reduce((s, t) => s + (t.merchandise_id ? modalSatuan * t.qty : 0), 0)
  const keuntungan = totalHariIni - totalModal
  const tunai = transaksi.filter(t => t.metode === 'Tunai').reduce((s, t) => s + t.total, 0)
  const nonTunai = totalHariIni - tunai

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Penjualan Hari H</h1>
        <Link href="/dankelola/merchandise/kasir/new" className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium">+ Transaksi Baru</Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Transaksi</p>
          <p className="text-3xl font-bold text-primary-600">{transaksi.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Pendapatan</p>
          <p className="text-3xl font-bold text-green-600">{formatRupiah(totalHariIni)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Modal</p>
          <p className="text-3xl font-bold text-orange-600">{formatRupiah(totalModal)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Keuntungan</p>
          <p className={`text-3xl font-bold ${keuntungan >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatRupiah(keuntungan)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Metode</p>
          <p className="text-sm font-semibold text-slate-900">Cash: {formatRupiah(tunai)}</p>
          <p className="text-sm font-semibold text-slate-900">Non-Tunai: {formatRupiah(nonTunai)}</p>
        </div>
      </div>

      {selectedKasir.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{selectedKasir.size}</span> transaksi dipilih</p>
          <button type="button" onClick={hapusTerpilih} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700">
            <Trash2 className="h-4 w-4" /> Hapus Terpilih
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              {!isViewer && <th className="px-3 py-2 w-8"><input type="checkbox" checked={transaksi.length > 0 && transaksi.every((t) => selectedKasir.has(t.id))} onChange={toggleSelectAllKasir} aria-label="Pilih semua" className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" /></th>}
              <th className="px-3 py-2">Waktu</th>
              <th className="px-3 py-2">Produk</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2 text-right">Harga Jual</th>
              <th className="px-3 py-2 text-right">Modal</th>
              <th className="px-3 py-2 text-right">Keuntungan</th>
              <th className="px-3 py-2">Metode</th>
              <th className="px-3 py-2">Bukti</th>
              <th className="px-3 py-2">Kasir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {transaksi.length === 0 && <tr><td colSpan={isViewer ? 9 : 10} className="px-3 py-6 text-center text-slate-400">Belum ada transaksi hari ini.</td></tr>}
            {transaksi.map((t) => {
              const modal = t.merchandise_id ? modalSatuan * t.qty : 0
              const laba = t.total - modal
              return (
                <tr key={t.id} className="hover:bg-slate-50">
                  {!isViewer && (<td className="px-3 py-2 align-top"><input type="checkbox" checked={selectedKasir.has(t.id)} onChange={() => toggleSelectKasir(t.id)} aria-label={`Pilih ${t.produk}`} className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" /></td>)}
                  <td className="px-3 py-2 text-slate-500">{new Date(t.tanggal).toLocaleString('id-ID')}</td>
                  <td className="px-3 py-2 font-medium">
                    {t.produk}
                    {(t.warna || t.lengan) && (
                      <div className="text-[11px] text-slate-500">{[t.warna, t.lengan].filter(Boolean).join(' · ')}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">{t.qty}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {formatRupiah(t.total)}
                    {t.diskon > 0 && <div className="text-[11px] text-green-600">Diskon -{formatRupiah(t.diskon)}</div>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-orange-600">{formatRupiah(modal)}</td>
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums ${laba >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatRupiah(laba)}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${t.metode === 'Tunai' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                      {t.metode === 'Tunai' ? 'Cash' : t.metode}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {t.bukti_url ? (
                      <BuktiThumb url={t.bukti_url} label={`Bukti ${t.produk}`} onPreview={() => setPreviewBukti(t.bukti_url)} />
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{t.dicatat_oleh || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <BuktiPreviewModal url={previewBukti} onClose={() => setPreviewBukti(null)} />
    </div>
  )
}