'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import type { TicketKatalogItem, TicketPeriode } from '@/lib/types'
import { formatRupiah, todayISO } from '@/lib/utils'
import { useConfirm } from '@/components/confirm-dialog'

export default function PeriodePage() {
  const confirm = useConfirm()
  const [tiket, setTiket] = useState<TicketKatalogItem[]>([])
  const [periode, setPeriode] = useState<TicketPeriode[]>([])
  const [selectedTipe, setSelectedTipe] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [t, p] = await Promise.all([
      getJSON<TicketKatalogItem[]>('/api/ticket'),
      getJSON<TicketPeriode[]>('/api/ticket/periode'),
    ])
    setTiket(t)
    setPeriode(p)
    setSelectedTipe((prev) => (t.some((item) => item.id === prev) ? prev : t[0]?.id || ''))
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => {
        console.error('Failed to load ticket period:', e)
        setError('Gagal memuat periode harga')
      })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  async function hapus(p: TicketPeriode) {
    const ok = await confirm({
      title: 'Hapus periode harga?',
      description: 'Periode harga ini akan dihapus permanen.',
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      await sendJSON('/api/ticket/periode', 'DELETE', { id: p.id })
      toast.success('Periode dihapus')
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (loading) return <PageSkeleton />
  if (error)
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Periode Harga</h1>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-600">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">
            Coba Lagi
          </button>
        </div>
      </div>
    )

  const tipe = tiket.find((t) => t.id === selectedTipe)
  const daftar = periode.filter((p) => p.tiket_tipe_id === selectedTipe)
  const today = todayISO()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Periode Harga</h1>
          <p className="text-sm text-slate-500">Harga tiket otomatis mengikuti periode yang aktif hari ini.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dankelola/ticket/tahap"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Tipe & Harga
          </Link>
          <Link
            href="/dankelola/ticket/periode/new"
            className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white"
          >
            + Tambah Periode
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/40">
        <label className="mb-1 block text-sm font-medium">Tipe Tiket</label>
        <select
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:w-80"
          value={selectedTipe}
          onChange={(e) => setSelectedTipe(e.target.value)}
        >
          {tiket.length === 0 && <option value="">Belum ada tipe tiket</option>}
          {tiket.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nama} ({t.jumlah_orang} orang)
            </option>
          ))}
        </select>
        {tipe && (
          <p className="mt-2 text-sm text-slate-500">
            Harga dasar {formatRupiah(Number(tipe.harga))}
            {tipe.periode_aktif && ` · periode aktif: ${tipe.periode_aktif.nama || 'tanpa nama'}`}
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2">Tanggal</th>
              <th className="px-3 py-2">Harga</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {daftar.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  Belum ada periode untuk tipe ini.
                </td>
              </tr>
            )}
            {daftar.map((p) => {
              const aktif = today >= p.tanggal_mulai && today <= p.tanggal_selesai
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{p.nama || '-'}</td>
                  <td className="px-3 py-2">
                    {new Date(p.tanggal_mulai).toLocaleDateString('id-ID')} -{' '}
                    {new Date(p.tanggal_selesai).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-3 py-2">{formatRupiah(Number(p.harga))}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        aktif ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {aktif ? 'Aktif' : 'Tidak aktif'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Link
                        href={`/dankelola/ticket/periode/${p.id}/edit`}
                        className="text-primary-600 hover:underline"
                      >
                        Edit
                      </Link>
                      <button onClick={() => hapus(p)} className="text-red-600 hover:underline">
                        Hapus
                      </button>
                    </div>
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
