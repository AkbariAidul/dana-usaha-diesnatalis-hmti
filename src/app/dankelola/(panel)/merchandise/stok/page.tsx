'use client'

import { DataError } from '@/components/data-error'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, ChevronDown, LayoutGrid, Rows3, Wallet, FileSpreadsheet } from 'lucide-react'
import { getJSON } from '../../../api'
import { exportReportPdf } from '@/lib/report-export'
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

type Row = { produk: string; warna: string; lengan: string; ukuran: string; qty: number; omset: number; modal: number; jumlahPo: number }

type ProdukRingkasan = {
  produk: string
  qty: number
  omset: number
  modal: number
  untung: number
  jumlahPo: number
  ukuran: Map<string, number>
  warna: Map<string, number>
  lengan: Map<string, number>
}

type Mode = 'ringkas' | 'grid' | 'tabel'

export default function StokPage() {
  const [poList, setPoList] = useState<PoData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('ringkas')
  const [expandedProduk, setExpandedProduk] = useState<string | null>(null)
  const [showRincian, setShowRincian] = useState(false)

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
    type RawRow = { produk: string; warna: string; lengan: string; ukuran: string; qty: number; omset: number; modal: number; po: Set<string> }
    const rowMap = new Map<string, RawRow>()
    const produkMap = new Map<string, Omit<ProdukRingkasan, 'jumlahPo'>>()

    for (const po of poList) {
      if (po.status !== 'lunas') continue
      for (const item of po.items ?? []) {
        const produk = item.merchandise?.nama ?? 'Merchandise'
        const warna = item.warna || '-'
        const lengan = item.lengan || '-'
        const ukuran = item.varian?.nama || item.ukuran || '-'
        const key = `${produk}|${warna}|${lengan}|${ukuran}`
        const row = rowMap.get(key) ?? { produk, warna, lengan, ukuran, qty: 0, omset: 0, modal: 0, po: new Set() }
        row.qty += Number(item.qty)
        row.omset += Number(item.subtotal ?? 0)
        row.modal += Number(item.modal_total ?? 0)
        row.po.add(po.id)
        rowMap.set(key, row)

        const p = produkMap.get(produk) ?? {
          produk,
          qty: 0,
          omset: 0,
          modal: 0,
          untung: 0,
          ukuran: new Map(),
          warna: new Map(),
          lengan: new Map(),
        }
        p.qty += Number(item.qty)
        p.omset += Number(item.subtotal ?? 0)
        p.modal += Number(item.modal_total ?? 0)
        p.ukuran.set(ukuran, (p.ukuran.get(ukuran) ?? 0) + Number(item.qty))
        p.warna.set(warna, (p.warna.get(warna) ?? 0) + Number(item.qty))
        p.lengan.set(lengan, (p.lengan.get(lengan) ?? 0) + Number(item.qty))
        produkMap.set(produk, p)
      }
    }

    const rows: Row[] = [...rowMap.values()].map((r) => ({
      ...r,
      jumlahPo: r.po.size,
    }))
    rows.sort((a, b) =>
      a.produk.localeCompare(b.produk) ||
      a.warna.localeCompare(b.warna) ||
      a.lengan.localeCompare(b.lengan) ||
      a.ukuran.localeCompare(b.ukuran),
    )

    const produkUniquePo = new Map<string, string[]>()
    for (const po of poList) {
      if (po.status !== 'lunas') continue
      const seen = new Set<string>()
      for (const item of po.items ?? []) {
        const produk = item.merchandise?.nama ?? 'Merchandise'
        if (!seen.has(produk)) {
          seen.add(produk)
          const list = produkUniquePo.get(produk) ?? []
          list.push(po.id)
          produkUniquePo.set(produk, list)
        }
      }
    }

    const products: ProdukRingkasan[] = [...produkMap.values()].map((p) => ({
      ...p,
      untung: p.omset - p.modal,
      jumlahPo: (produkUniquePo.get(p.produk) ?? []).length,
      ukuran: new Map([...p.ukuran.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
      warna: new Map([...p.warna.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
      lengan: new Map([...p.lengan.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    }))

    return { rekap: rows, perProduk: products }
  }, [poList])

  const totalPo = poList.filter((po) => po.status === 'lunas').length
  const totalQtyPo = rekap.reduce((sum, row) => sum + row.qty, 0)
  const totalOmset = rekap.reduce((sum, row) => sum + row.omset, 0)
  const totalBiayaCetak = rekap.reduce((sum, row) => sum + row.modal, 0)
  const totalKeuntungan = totalOmset - totalBiayaCetak

  function toggleProduk(nama: string) {
    setExpandedProduk((prev) => (prev === nama ? null : nama))
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

  function RingkasanBox({ label, value, subLabel, color = 'slate' }: { label: string; value: React.ReactNode; subLabel?: string; color?: 'slate' | 'violet' | 'amber' | 'green' | 'red' }) {
    const colorClasses: Record<string, string> = {
      slate: 'border-slate-200/70 bg-white',
      violet: 'border-violet-200 bg-violet-50/60',
      amber: 'border-amber-200 bg-amber-50/60',
      green: 'border-green-200 bg-green-50/60',
      red: 'border-red-200 bg-red-50/60',
    }
    const textClass = color === 'slate' ? 'text-slate-900' : `text-${color}-800`
    const subTextClass = color === 'slate' ? 'text-slate-500' : 'opacity-75'
    return (
      <div className={`rounded-2xl border p-4 shadow-sm ${colorClasses[color]}`}>
        <p className={`text-xs ${subTextClass}`}>{label}</p>
        <p className={`mt-1 text-xl font-bold ${textClass}`}>{value}</p>
        {subLabel && <p className={`mt-0.5 text-xs ${subTextClass}`}>{subLabel}</p>}
      </div>
    )
  }

  function CardProduk({ produk }: { produk: ProdukRingkasan }) {
    const isExpanded = expandedProduk === produk.produk
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm transition-shadow hover:shadow-md">
        <button
          type="button"
          onClick={() => toggleProduk(produk.produk)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{produk.produk}</p>
            <p className="mt-0.5 text-xs text-slate-500">{produk.qty} pcs · {produk.jumlahPo} PO</p>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{formatRupiah(produk.omset)}</span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{formatRupiah(produk.modal)}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${produk.untung >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {formatRupiah(produk.untung)}
            </span>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
        <div className={`border-t border-slate-100 px-5 py-4 ${isExpanded ? 'block' : 'hidden'} sm:block`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Breakdown title="Per Ukuran" data={[...produk.ukuran.entries()]} />
            <Breakdown title="Per Warna" data={[...produk.warna.entries()]} />
            <Breakdown title="Per Lengan" data={[...produk.lengan.entries()]} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 sm:hidden">
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2">
              <p className="text-[10px] text-violet-700">Omset</p>
              <p className="font-semibold text-violet-800">{formatRupiah(produk.omset)}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2">
              <p className="text-[10px] text-amber-700">Modal</p>
              <p className="font-semibold text-amber-800">{formatRupiah(produk.modal)}</p>
            </div>
            <div className={`rounded-xl border px-3 py-2 ${produk.untung >= 0 ? 'border-green-200 bg-green-50/60' : 'border-red-200 bg-red-50/60'}`}>
              <p className={`text-[10px] ${produk.untung >= 0 ? 'text-green-700' : 'text-red-700'}`}>Untung</p>
              <p className={`font-semibold ${produk.untung >= 0 ? 'text-green-800' : 'text-red-800'}`}>{formatRupiah(produk.untung)}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function TabelRekap() {
    return (
      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Produk</th>
              <th className="px-3 py-2">Warna</th>
              <th className="px-3 py-2">Lengan</th>
              <th className="px-3 py-2">Ukuran</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">PO</th>
              <th className="px-3 py-2 text-right">Omset</th>
              <th className="px-3 py-2 text-right">Modal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {rekap.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                  Belum ada item pre-order lunas.
                </td>
              </tr>
            )}
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
    )
  }

  async function handleDownload() {
    const report = {
      title: 'Rekap Produksi & Stok Merchandise',
      filename: 'produksi-stok-merchandise',
      summary: [
        { label: 'PO Lunas', value: String(totalPo) },
        { label: 'Total Pcs', value: String(totalQtyPo) },
      ],
      sheets: [
        {
          name: 'Detail per Varian',
          headers: ['Produk', 'Warna', 'Lengan', 'Ukuran', 'Qty'],
          rows: rekap.map((row) => [
            row.produk,
            row.warna,
            row.lengan,
            row.ukuran,
            row.qty,
          ]),
        },
        {
          name: 'Ringkasan per Ukuran',
          headers: ['Produk', 'Ukuran', 'Qty'],
          rows: perProduk.flatMap((p) =>
            [...p.ukuran.entries()].map(([ukuran, qty]) => [p.produk, ukuran, qty]),
          ),
        },
        {
          name: 'Ringkasan per Warna',
          headers: ['Produk', 'Warna', 'Qty'],
          rows: perProduk.flatMap((p) =>
            [...p.warna.entries()].map(([warna, qty]) => [p.produk, warna, qty]),
          ),
        },
        {
          name: 'Ringkasan per Lengan',
          headers: ['Produk', 'Lengan', 'Qty'],
          rows: perProduk.flatMap((p) =>
            [...p.lengan.entries()].map(([lengan, qty]) => [p.produk, lengan, qty]),
          ),
        },
      ],
    }
    await exportReportPdf(report)
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="flex justify-center">
      <DataError title={error} />
    </div>
  )

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Produksi & Stok</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/dankelola/merchandise/pengambilan"
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-700"
          >
            <CalendarClock className="h-4 w-4" /> Atur Pengambilan
          </Link>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4" /> Unduh PDF Percetakan
          </button>
        </div>
      </div>

      <div className="print:hidden">
        <div className="mb-3 flex items-center gap-2 overflow-x-auto">
          {([
            ['ringkas', 'Ringkas'],
            ['grid', 'Grid'],
            ['tabel', 'Tabel'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                mode === key
                  ? 'border-primary-300 bg-primary-50 text-primary-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowRincian((v) => !v)}
            className={`ml-auto rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              showRincian
                ? 'border-primary-300 bg-primary-50 text-primary-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {showRincian ? 'Sembunyikan Rincian' : 'Tampilkan Rincian'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 print:grid">
        <RingkasanBox
          label="PO Lunas"
          value={totalPo}
          subLabel="Pesanan siap produksi"
        />
        <RingkasanBox
          label="Total Pcs"
          value={totalQtyPo}
          subLabel="Item produksi"
        />
        <RingkasanBox
          label="Omset"
          value={formatRupiah(totalOmset)}
          subLabel="Pendapatan kotor"
          color="violet"
        />
        <RingkasanBox
          label="Biaya Cetak"
          value={formatRupiah(totalBiayaCetak)}
          subLabel="Modal percetakan"
          color="amber"
        />
        <RingkasanBox
          label="Keuntungan"
          value={formatRupiah(totalKeuntungan)}
          subLabel="Selisih omset - modal"
          color={totalKeuntungan >= 0 ? 'green' : 'red'}
        />
      </div>

      <div className="print:hidden">
        <div className="mb-2 flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-600">Rekap per Produk</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{perProduk.length} produk</span>
        </div>
        {perProduk.length === 0 && (
          <div className="rounded-xl border border-dashed py-8 text-center">
            <Wallet className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">Belum ada pre-order lunas.</p>
          </div>
        )}
        {mode === 'ringkas' && (
          <div className="space-y-2">
            {perProduk.map((produk) => (
              <CardProduk key={produk.produk} produk={produk} />
            ))}
          </div>
        )}
        {mode === 'grid' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {perProduk.map((produk) => (
              <div key={produk.produk} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">{produk.produk}</p>
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{produk.qty} pcs</span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Breakdown title="Per Ukuran" data={[...produk.ukuran.entries()]} />
                  <Breakdown title="Per Warna" data={[...produk.warna.entries()]} />
                  <Breakdown title="Per Lengan" data={[...produk.lengan.entries()]} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-xs">
                  <div>
                    <p className="text-slate-500">Omset</p>
                    <p className="font-semibold text-slate-900">{formatRupiah(produk.omset)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Modal</p>
                    <p className="font-semibold text-slate-900">{formatRupiah(produk.modal)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500">Untung</p>
                    <p className={`font-semibold ${produk.untung >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatRupiah(produk.untung)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {mode === 'tabel' && <TabelRekap />}
      </div>

      {showRincian && (
        <div className="print:block">
          <div className="mb-2 flex items-center gap-2 print:hidden">
            <Rows3 className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-600">Rincian Pre-Order per Varian</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{rekap.length} baris</span>
          </div>
          <TabelRekap />
        </div>
      )}
    </div>
  )
}
