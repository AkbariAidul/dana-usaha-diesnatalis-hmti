'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Save, Wallet } from 'lucide-react'
import { getJSON, sendJSON } from '../../../api'
import { PageSkeleton } from '../../ui'
import type { TicketKatalogItem } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'

const input =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100'

export default function TicketModalPage() {
  const [tiket, setTiket] = useState<TicketKatalogItem[]>([])
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const data = await getJSON<TicketKatalogItem[]>('/api/ticket')
    setTiket(data)
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => { setError('Gagal memuat data tiket'); console.error(e) })
      .finally(() => setLoading(false))
  }, [load])

  function nilaiModal(t: TicketKatalogItem) {
    return edits[t.id] ?? String(Number(t.modal ?? 0))
  }

  async function simpan() {
    const changed = tiket.filter(
      (t) => edits[t.id] !== undefined && Number(edits[t.id]) !== Number(t.modal ?? 0)
    )
    if (changed.length === 0) {
      toast.info('Tidak ada perubahan modal')
      return
    }
    for (const t of changed) {
      const v = Number(edits[t.id])
      if (!Number.isFinite(v) || v < 0) {
        toast.error(`Modal ${t.nama} tidak valid`)
        return
      }
    }
    setSaving(true)
    try {
      await Promise.all(
        changed.map((t) => sendJSON('/api/ticket', 'POST', { id: t.id, modal: Number(edits[t.id]) }))
      )
      setEdits({})
      await load()
      toast.success('Modal tiket disimpan')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Kelola Modal</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/dankelola/ticket/tahap" className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-600">
            <ArrowLeft className="h-3.5 w-3.5" /> Tipe & Harga
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Kelola Modal</h1>
          <p className="text-sm text-slate-500">Atur biaya gelang per tiket untuk menghitung keuntungan penjualan.</p>
        </div>
        <button
          onClick={simpan}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> {saving ? 'Menyimpan…' : 'Simpan Modal'}
        </button>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-primary-100 bg-primary-50/60 p-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-100 text-primary-600">
          <Wallet className="h-4 w-4" />
        </div>
        <p className="text-sm text-primary-800">
          Modal adalah biaya gelang/wristband untuk satu tiket. Keuntungan per tiket dihitung dari harga jual aktif dikurangi modal.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Tipe Tiket</th>
              <th className="px-4 py-3 font-medium text-slate-600">Modal / Tiket</th>
              <th className="px-4 py-3 font-medium text-slate-600">Harga Jual</th>
              <th className="px-4 py-3 font-medium text-slate-600">Keuntungan / Tiket</th>
              <th className="px-4 py-3 font-medium text-slate-600">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tiket.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  Belum ada tipe tiket.
                  <Link href="/dankelola/ticket/tipe/new" className="mt-2 block text-primary-600 hover:underline">+ Tambah Tipe Pertama</Link>
                </td>
              </tr>
            )}
            {tiket.map((t) => {
              const modal = Number(nilaiModal(t)) || 0
              const harga = Number(t.harga_aktif)
              const laba = harga - modal
              const margin = harga > 0 ? Math.round((laba / harga) * 100) : 0
              return (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{t.nama}</p>
                    <p className="text-xs text-slate-500">{t.jumlah_orang} orang</p>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={nilaiModal(t)}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [t.id]: e.target.value }))}
                      className={`${input} max-w-[160px]`}
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold text-primary-600">{formatRupiah(harga)}</td>
                  <td className={`px-4 py-3 font-semibold ${laba >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatRupiah(laba)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      margin >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {margin}%
                    </span>
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
