'use client'

import { DataError } from '@/components/data-error'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarClock } from 'lucide-react'
import { getJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { formatRupiah } from '@/lib/utils'
import { PageSkeleton } from '../../ui'

type PoItem = {
  id: string
  ukuran: string | null
  warna: string | null
  lengan: string | null
  qty: number
  subtotal: number
  harga_satuan: number
  modal_satuan: number
  modal_total: number
  merchandise: { nama: string } | null
  varian: { nama: string } | null
}

type PoData = {
  id: string
  status: string
  tipe_pemesan: string
  total: number
  modal_satuan?: number
  modal_total?: number
  keuntungan?: number
  items: PoItem[]
}

function Breakdown({ title, data }: { title: string; data: [string, number][] }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <div className="mt-1 space-y-1">
        {data.length === 0 && <p className="text-xs text-slate-400">-</p>}
        {data.map(([label, qty]) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="font-medium tabular-nums text-slate-900">{qty}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

type SummaryColor = 'slate' | 'violet' | 'amber' | 'green' | 'red'
const summaryColorClass: Record<SummaryColor, string> = {
  slate: 'border-slate-200/70 bg-white text-slate-900',
  violet: 'border-violet-200 bg-violet-50/60 text-violet-800',
  amber: 'border-amber-200 bg-amber-50/60 text-amber-800',
  green: 'border-green-200 bg-green-50/60 text-green-800',
  red: 'border-red-200 bg-red-50/60 text-red-800',
}

function RingkasanBox({ label, value, color = 'slate', ring = false }: { label: string; value: React.ReactNode; color?: SummaryColor; ring?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${summaryColorClass[color]} ${ring ? 'ring-2 ring-primary-300' : ''}`}>
      <p className={`text-xs ${color === 'slate' ? 'text-slate-500' : 'opacity-75'}`}>{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  )
}

export default function StokPage() {
  const [poList, setPoList] = useState<PoData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const po = await getJSON<PoData[]>('/api/merchandise/preorder').catch(() => [])
    setPoList(Array.isArray(po) ? po : [])
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => {
        console.error('Failed to load stok:', e)
        setError('Gagal memuat data produksi')
      })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  const { rekap, perProduk } = useMemo(() => {
    type Row = { produk: string; warna: string; lengan: string; ukuran: string; qty: number; omset: number; modal: number; po: Set<string> }
    const rowMap = new Map<string, Omit<Row, 'jumlahPo'> & { po: Set<string> }>()
    const produkMap = new Map<string, { produk: string; qty: number; omset: number; modal: number; ukuran: Map<string, number>; warna: Map<string, number>; lengan: Map<string, number> }>()

    for (const po of poList) {
      if (po.status !== 'lunas') continue
      for (const item of po.items ?? []) {
        const produk = item.merchandise?.nama ?? 'Merchandise'
        const warna = item.warna || '-'
        const lengan = item.lengan || '-'
        const ukuran = item.varian?.nama || item.ukuran || '-'
        const key = `${produk}|${warna}|${lengan}|${ukuran}`
        const row = rowMap.get(key) ?? { produk, warna, lengan, ukuran, qty: 0, omset: 0, modal: 0, po: new Set() }
        const qty = Number(item.qty)
        const omset = Number(item.subtotal ?? 0)
        const modal = Number(item.modal_total ?? 0)
        row.qty += qty
        row.omset += omset
        row.modal += modal
        row.po.add(po.id)
        rowMap.set(key, row)

        const p = produkMap.get(produk) ?? { produk, qty: 0, omset: 0, modal: 0, ukuran: new Map(), warna: new Map(), lengan: new Map() }
        p.qty += qty
        p.omset += omset
        p.modal += modal
        p.ukuran.set(ukuran, (p.ukuran.get(ukuran) ?? 0) + qty)
        p.warna.set(warna, (p.warna.get(warna) ?? 0) + qty)
        p.lengan.set(lengan, (p.lengan.get(lengan) ?? 0) + qty)
        produkMap.set(produk, p)
      }
    }

    const rows: Array<Row & { jumlahPo: number }> = [...rowMap.values()].map((r) => ({ ...r, jumlahPo: r.po.size }))
    rows.sort((a, b) =>
      a.produk.localeCompare(b.produk) ||
      a.warna.localeCompare(b.warna) ||
      a.lengan.localeCompare(b.lengan) ||
      a.ukuran.localeCompare(b.ukuran),
    )

    const products = [...produkMap.values()].map((p) => ({
      produk: p.produk,
      qty: p.qty,
      omset: p.omset,
      modal: p.modal,
      untung: p.omset - p.modal,
      ukuran: [...p.ukuran.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      warna: [...p.warna.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      lengan: [...p.lengan.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    }))

    return { rekap: rows, perProduk: products }
  }, [poList])

  const totalPo = poList.filter((po) => po.status === 'lunas').length
  const totalQtyPo = rekap.reduce((sum, row) => sum + row.qty, 0)
  const totalOmset = rekap.reduce((sum, row) => sum + row.omset, 0)
  const totalBiayaCetak = rekap.reduce((sum, row) => sum + row.modal, 0)
  const totalKeuntungan = totalOmset - totalBiayaCetak

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="flex justify-center">
      <DataError title={error} />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Produksi & Stok</h1>
        <Link
          href="/dankelola/merchandise/pengambilan"
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-700"
        >
          <CalendarClock className="h-4 w-4" /> Atur Pengambilan
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <RingkasanBox label="PO Lunas" value={totalPo} ring />
        <RingkasanBox label="Total Pcs" value={totalQtyPo} />
        <RingkasanBox label="Omset" value={formatRupiah(totalOmset)} color="violet" />
        <RingkasanBox label="Biaya Cetak" value={formatRupiah(totalBiayaCetak)} color="amber" />
        <RingkasanBox label="Keuntungan" value={formatRupiah(totalKeuntungan)} color={totalKeuntungan >= 0 ? 'green' : 'red'} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Rekap per Produk</h2>
        {perProduk.length === 0 && (
          <p className="rounded-xl border border-dashed py-8 text-center text-sm text-slate-400">Belum ada pre-order lunas.</p>
        )}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {perProduk.map((p) => (
            <div key={p.produk} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-900">{p.produk}</p>
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{p.qty} pcs</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Breakdown title="Per Ukuran" data={p.ukuran} />
                <Breakdown title="Per Warna" data={p.warna} />
                <Breakdown title="Per Lengan" data={p.lengan} />
              </div>
              <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-3 text-sm">
                <div className="flex gap-4 text-xs text-slate-500">
                  <span>
                    Omset <strong className="ml-1 text-slate-900">{formatRupiah(p.omset)}</strong>
                  </span>
                  <span>
                    Modal <strong className="ml-1 text-slate-900">{formatRupiah(p.modal)}</strong>
                  </span>
                </div>
                <span className={`font-semibold ${p.untung >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Untung {formatRupiah(p.untung)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Rekap Pre-Order untuk Produksi</h2>
            <p className="text-xs text-slate-500">Total {totalPo} PO lunas · {totalQtyPo} item</p>
          </div>
          <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">Data cetak</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Produk</th>
              <th className="px-3 py-2">Warna</th>
              <th className="px-3 py-2">Lengan</th>
              <th className="px-3 py-2">Ukuran</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Jumlah PO</th>
              <th className="px-3 py-2 text-right">Omset</th>
              <th className="px-3 py-2 text-right">Modal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {rekap.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">Belum ada item pre-order lunas.</td></tr>}
            {rekap.map((row) => (
              <tr key={`${row.produk}|${row.warna}|${row.lengan}|${row.ukuran}`} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{row.produk}</td>
                <td className="px-3 py-2">{row.warna}</td>
                <td className="px-3 py-2">{row.lengan}</td>
                <td className="px-3 py-2">{row.ukuran}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{row.qty}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-500">{row.jumlahPo}</td>
                <td className="px-3 py-2 text-right tabular-nums text-violet-600">{formatRupiah(row.omset)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-600">{formatRupiah(row.modal)}</td>
              </tr>
            ))}
          </tbody>
          {rekap.length > 0 && (
            <tfoot className="bg-slate-50 font-semibold">
              <tr>
                <td className="px-3 py-2" colSpan={4}>Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{totalQtyPo}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right tabular-nums text-violet-600">{formatRupiah(totalOmset)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-600">{formatRupiah(totalBiayaCetak)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
