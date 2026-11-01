'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import type { TicketKatalogItem } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'

export default function TahapPage() {
  const [tiket, setTiket] = useState<TicketKatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const data = await getJSON<TicketKatalogItem[]>('/api/ticket')
    setTiket(data)
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => {
        console.error('Failed to load ticket:', e)
        setError('Gagal memuat data tiket')
      })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  async function toggle(t: TicketKatalogItem) {
    try {
      await sendJSON('/api/ticket', 'POST', { id: t.id, aktif: !t.aktif })
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function hapus(t: TicketKatalogItem) {
    if (!window.confirm(`Hapus tipe tiket "${t.nama}"?`)) return
    try {
      await sendJSON('/api/ticket', 'DELETE', { id: t.id })
      toast.success('Tipe tiket dihapus')
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (loading) return <PageSkeleton />
  if (error)
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tipe & Harga</h1>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-600">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">
            Coba Lagi
          </button>
        </div>
      </div>
    )

  const hariH = tiket.filter((t) => t.is_hari_h)
  const orderDibuka = tiket.filter((t) => t.buka).length
  const totalTerjualHariH = hariH.reduce((s, t) => s + Number(t.terjual ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tipe & Harga</h1>
          <p className="text-sm text-slate-500">Atur tiket yang tampil di halaman publik.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dankelola/ticket/periode"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Periode Harga
          </Link>
          <Link
            href="/dankelola/ticket/tipe/new"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
          >
            + Tambah Tipe
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Tipe Tiket</p>
          <p className="text-3xl font-bold text-indigo-600">{tiket.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Order Dibuka</p>
          <p className="text-3xl font-bold text-green-600">{orderDibuka}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Terjual Hari H</p>
          <p className="text-3xl font-bold text-orange-600">{totalTerjualHariH}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Tiket Hari H</h2>
            <p className="text-sm text-slate-500">Penjualan terbatas, otomatis berhenti saat kuota habis atau waktu tutup.</p>
          </div>
          <Link
            href="/dankelola/ticket/tipe/new"
            className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white"
          >
            + Buat Tiket Hari H
          </Link>
        </div>
        {hariH.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Belum ada tiket Hari H.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {hariH.map((t) => (
              <div key={t.id} className="rounded-xl border border-orange-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{t.nama}</p>
                    <p className="text-sm text-slate-500">
                      {Number(t.terjual ?? 0) + Number(t.pending ?? 0)} / {t.kuota} tiket
                      {Number(t.pending ?? 0) > 0 && ` (${t.pending} menunggu)`}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      t.buka ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {t.buka ? 'Dibuka' : 'Ditutup'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Sisa {t.sisa ?? 0} tiket · {formatRupiah(Number(t.harga_aktif))}
                </p>
                <p className="text-xs text-slate-500">
                  Tutup: {t.selesai_jual ? new Date(t.selesai_jual).toLocaleString('id-ID') : 'tanpa batas waktu'}
                </p>
                <Link
                  href={`/dankelola/ticket/tipe/${t.id}/edit`}
                  className="mt-3 inline-block rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Atur
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2">Untuk</th>
              <th className="px-3 py-2">Harga</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Hari H</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {tiket.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                  Belum ada tipe tiket.
                </td>
              </tr>
            )}
            {tiket.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <p className="font-medium">{t.nama}</p>
                  {t.deskripsi && <p className="text-xs text-slate-500">{t.deskripsi}</p>}
                </td>
                <td className="px-3 py-2">{t.jumlah_orang} orang</td>
                <td className="px-3 py-2">
                  {formatRupiah(Number(t.harga_aktif))}
                  {t.periode_aktif && (
                    <p className="text-xs text-slate-500">Periode: {t.periode_aktif.nama || 'aktif'}</p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      t.buka ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {t.buka ? 'Dibuka' : 'Ditutup'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {t.is_hari_h ? (
                    <div>
                      <p>
                        {Number(t.terjual ?? 0) + Number(t.pending ?? 0)} / {t.kuota} tiket
                      </p>
                      <p className="text-xs text-slate-500">Sisa {t.sisa ?? 0}</p>
                    </div>
                  ) : (
                    <span className="text-slate-400">Tanpa kuota</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/dankelola/ticket/tipe/${t.id}/edit`} className="text-indigo-600 hover:underline">
                      Edit
                    </Link>
                    <button onClick={() => toggle(t)} className="text-slate-600 hover:underline">
                      {t.aktif ? 'Tutup' : 'Buka'}
                    </button>
                    <button onClick={() => hapus(t)} className="text-red-600 hover:underline">
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
