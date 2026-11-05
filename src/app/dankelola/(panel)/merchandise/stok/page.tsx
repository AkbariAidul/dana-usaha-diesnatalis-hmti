'use client'

import { DataError } from '@/components/data-error'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { formatRupiah } from '@/lib/utils'
import { PageSkeleton } from '../../ui'

type PoItem = {
  id: string
  ukuran: string | null
  qty: number
  merchandise: { nama: string } | null
  varian: { nama: string } | null
}

type PoData = {
  id: string
  status: string
  modal_satuan?: number
  items: PoItem[]
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

  const rekap = useMemo(() => {
    const map = new Map<string, { produk: string; ukuran: string; qty: number; po: Set<string> }>()
    for (const po of poList) {
      if (po.status !== 'lunas') continue
      for (const item of po.items) {
        const produk = item.merchandise?.nama ?? 'Merchandise'
        const ukuran = item.varian?.nama || item.ukuran || '-'
        const key = `${produk}|${ukuran}`
        const row = map.get(key) ?? { produk, ukuran, qty: 0, po: new Set<string>() }
        row.qty += Number(item.qty)
        row.po.add(po.id)
        map.set(key, row)
      }
    }
    return [...map.values()]
      .map((row) => ({ produk: row.produk, ukuran: row.ukuran, qty: row.qty, jumlahPo: row.po.size }))
      .sort((a, b) => a.produk.localeCompare(b.produk) || a.ukuran.localeCompare(b.ukuran))
  }, [poList])
  const totalPo = poList.filter((po) => po.status === 'lunas').length
  const totalQtyPo = rekap.reduce((sum, row) => sum + row.qty, 0)
  const modalSatuan = poList.find((po) => Number(po.modal_satuan ?? 0) > 0)?.modal_satuan ?? 0
  const totalBiayaCetak = totalQtyPo * Number(modalSatuan)
  const perProduk = useMemo(() => {
    const map = new Map<string, { produk: string; qty: number; ukuran: Map<string, number> }>()
    for (const row of rekap) {
      const produk = map.get(row.produk) ?? { produk: row.produk, qty: 0, ukuran: new Map<string, number>() }
      produk.qty += row.qty
      produk.ukuran.set(row.ukuran, (produk.ukuran.get(row.ukuran) ?? 0) + row.qty)
      map.set(row.produk, produk)
    }
    return [...map.values()].map((p) => ({
      produk: p.produk,
      qty: p.qty,
      ukuran: [...p.ukuran.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    }))
  }, [rekap])

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Produksi & Stok</h1>
      <DataError title={error} />
    </div>
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Produksi & Stok</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {perProduk.map((p) => (
          <div key={p.produk} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/40">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-slate-900">{p.produk}</p>
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{p.qty} pcs</span>
            </div>
            <div className="mt-3 space-y-1.5">
              {p.ukuran.map(([ukuran, qty]) => (
                <div key={ukuran} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{ukuran}</span>
                  <span className="font-medium tabular-nums text-slate-900">{qty}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm shadow-violet-100">
        <p className="text-sm font-medium text-violet-700">Total Biaya Percetakan</p>
        <p className="mt-1 text-2xl font-bold text-violet-800">{formatRupiah(totalBiayaCetak)}</p>
        <p className="mt-1 text-xs text-violet-600">
          {totalQtyPo} pcs x {formatRupiah(Number(modalSatuan))} modal/pcs
        </p>
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
              <th className="px-3 py-2">Ukuran</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Jumlah PO</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {rekap.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Belum ada item pre-order lunas.</td></tr>}
            {rekap.map((row) => (
              <tr key={`${row.produk}|${row.ukuran}`} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{row.produk}</td>
                <td className="px-3 py-2">{row.ukuran}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{row.qty}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-500">{row.jumlahPo}</td>
              </tr>
            ))}
          </tbody>
          {rekap.length > 0 && (
            <tfoot className="bg-slate-50 font-semibold">
              <tr>
                <td className="px-3 py-2" colSpan={2}>Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{totalQtyPo}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
