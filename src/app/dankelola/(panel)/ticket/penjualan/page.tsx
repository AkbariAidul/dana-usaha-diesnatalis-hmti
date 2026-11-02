'use client'

import { useCallback, useEffect, useState } from 'react'
import { Inbox, Ticket } from 'lucide-react'
import { getJSON } from '../../../api'
import { PageSkeleton } from '../../ui'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { formatRupiah } from '@/lib/utils'
import type { PesananTiket } from '@/lib/types'

const STATUS: Record<PesananTiket['status'], { label: string; className: string; dot: string }> = {
  menunggu_verifikasi: { label: 'Menunggu', className: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  lunas: { label: 'Lunas', className: 'bg-green-50 text-green-700 ring-green-200', dot: 'bg-green-500' },
  ditolak: { label: 'Ditolak', className: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
  batal: { label: 'Batal', className: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
}

export default function PenjualanPage() {
  const [pesanan, setPesanan] = useState<PesananTiket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const data = await getJSON<PesananTiket[]>('/api/ticket/penjualan')
    setPesanan(data)
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => { setError('Gagal memuat data penjualan'); console.error(e) })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Penjualan Tiket</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  const lunas = pesanan.filter((p) => p.status === 'lunas')
  const totalTiket = lunas.reduce((s, p) => s + Number(p.jumlah), 0)
  const totalPenjualan = lunas.reduce((s, p) => s + Number(p.total), 0)
  const totalModal = lunas.reduce((s, p) => s + Number(p.modal_total), 0)
  const totalKeuntungan = lunas.reduce((s, p) => s + Number(p.keuntungan), 0)

  const rekap = (() => {
    const map = new Map<string, { tipe: string; periode: string; jumlah: number; penjualan: number; modal: number; keuntungan: number }>()
    for (const p of lunas) {
      const tipe = p.tiket_nama ?? '-'
      const periode = p.periode_nama ?? 'Harga dasar'
      const key = `${tipe}|${periode}`
      const row = map.get(key) ?? { tipe, periode, jumlah: 0, penjualan: 0, modal: 0, keuntungan: 0 }
      row.jumlah += Number(p.jumlah)
      row.penjualan += Number(p.total)
      row.modal += Number(p.modal_total)
      row.keuntungan += Number(p.keuntungan)
      map.set(key, row)
    }
    return Array.from(map.values()).sort((a, b) => a.tipe.localeCompare(b.tipe) || a.periode.localeCompare(b.periode))
  })()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-500" />
            </span>
            Live
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Penjualan Tiket</h1>
          <p className="text-sm text-slate-500">Ringkasan modal, harga jual, dan keuntungan dari semua tipe & periode.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          <Ticket className="h-4 w-4 text-primary-500" />
          <span className="font-semibold text-slate-900">{totalTiket}</span> tiket terjual
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Rekap per Tipe & Periode</h2>
            <p className="text-xs text-slate-500">Dihitung dari pesanan berstatus lunas.</p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {rekap.length} baris
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Tipe</th>
                <th className="px-5 py-3">Periode</th>
                <th className="px-5 py-3 text-right">Tiket</th>
                <th className="px-5 py-3 text-right">Penjualan</th>
                <th className="px-5 py-3 text-right">Modal</th>
                <th className="px-5 py-3 text-right">Keuntungan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {rekap.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    <p className="text-sm text-slate-400">Belum ada penjualan lunas.</p>
                  </td>
                </tr>
              )}
              {rekap.map((r) => (
                <tr key={`${r.tipe}|${r.periode}`} className="transition-colors hover:bg-slate-50/70">
                  <td className="px-5 py-3 font-medium text-slate-900">{r.tipe}</td>
                  <td className="px-5 py-3 text-slate-500">{r.periode}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-700">{r.jumlah}</td>
                  <td className="px-5 py-3 text-right font-medium tabular-nums text-slate-900">{formatRupiah(r.penjualan)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-orange-600">{formatRupiah(r.modal)}</td>
                  <td className={`px-5 py-3 text-right font-semibold tabular-nums ${r.keuntungan >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatRupiah(r.keuntungan)}
                  </td>
                </tr>
              ))}
            </tbody>
            {rekap.length > 0 && (
              <tfoot className="border-t border-slate-200 bg-slate-50/60">
                <tr className="text-sm font-semibold text-slate-900">
                  <td colSpan={2} className="px-5 py-3">Total</td>
                  <td className="px-5 py-3 text-right tabular-nums">{totalTiket}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatRupiah(totalPenjualan)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-orange-600">{formatRupiah(totalModal)}</td>
                  <td className={`px-5 py-3 text-right tabular-nums ${totalKeuntungan >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatRupiah(totalKeuntungan)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Semua Pesanan</h2>
            <p className="text-xs text-slate-500">Modal dan keuntungan memakai modal per tiket saat ini.</p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {pesanan.length} pesanan
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">No. Pesanan</th>
                <th className="px-5 py-3">Pembeli</th>
                <th className="px-5 py-3">Kontak</th>
                <th className="px-5 py-3">Tiket</th>
                <th className="px-5 py-3">Periode</th>
                <th className="px-5 py-3 text-right">Jumlah</th>
                <th className="px-5 py-3 text-right">Harga Jual</th>
                <th className="px-5 py-3 text-right">Modal</th>
                <th className="px-5 py-3 text-right">Keuntungan</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {pesanan.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center">
                    <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    <p className="text-sm text-slate-400">Belum ada penjualan.</p>
                  </td>
                </tr>
              )}
              {pesanan.map((p) => {
                const status = STATUS[p.status]
                return (
                  <tr key={p.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.no_pesanan}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-50 text-[11px] font-semibold text-primary-700">
                          {p.nama_pembeli.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-medium text-slate-900">{p.nama_pembeli}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{p.kontak}</td>
                    <td className="px-5 py-3 text-slate-700">{p.tiket_nama || '-'}</td>
                    <td className="px-5 py-3 text-slate-500">{p.periode_nama || 'Harga dasar'}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700">{p.jumlah}</td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-slate-900">{formatRupiah(Number(p.total))}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-orange-600">{formatRupiah(Number(p.modal_total))}</td>
                    <td className={`px-5 py-3 text-right font-semibold tabular-nums ${Number(p.keuntungan) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatRupiah(Number(p.keuntungan))}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${status.className}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
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
