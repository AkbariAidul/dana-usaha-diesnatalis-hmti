'use client'

import { DataError } from '@/components/data-error'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { getJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import type { KategoriSewa, HargaDasar, PeriodeHarga } from '@/lib/types'
import { periodeDariTanggal } from '@/lib/types'
import { kategoriTenant } from '@/lib/tenant'
import { formatRupiah, todayISO } from '@/lib/utils'

type Master = { kategori: KategoriSewa[]; hargaDasar: HargaDasar[]; periode: PeriodeHarga[] }

export default function HargaPage() {
  const [kategori, setKategori] = useState<KategoriSewa[]>([])
  const [hargaDasar, setHargaDasar] = useState<HargaDasar[]>([])
  const [periods, setPeriods] = useState<PeriodeHarga[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const m = await getJSON<Master>('/api/master')
    setKategori(kategoriTenant(m.kategori || []))
    setHargaDasar(m.hargaDasar || [])
    setPeriods(m.periode || [])
  }, [])

  useEffect(() => {
    load()
      .catch((e) => {
        console.error('Failed to load master data:', e)
        setError('Gagal memuat data master')
      })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  const activeKode = periodeDariTanggal(todayISO(), periods)
  const activePeriod = periods.find((p) => p.kode === activeKode)

  const hargaPerKategori = useMemo(() => {
    const map = new Map<string, number | null>()
    for (const k of kategori) {
      const h = hargaDasar.find((h) => h.kategori_sewa_id === k.id && h.periode === activeKode && h.jenis_usaha === 'F&B')
        ?? hargaDasar.find((h) => h.kategori_sewa_id === k.id && h.periode === activeKode)
      map.set(k.id, h ? Number(h.harga) : null)
    }
    return map
  }, [kategori, hargaDasar, activeKode])

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="flex justify-center">
      <DataError title={error} />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Paket & Harga Tenant</h1>
          <p className="text-sm text-slate-500">Kelola paket tenant, harga per periode, dan modal sewa.</p>
        </div>
        <Link
          href="/dankelola/tenants/harga/new"
          className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700"
        >
          + Tambah Paket
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-600">
            <tr>
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Paket</th>
              <th className="px-4 py-3">Fasilitas</th>
              <th className="px-4 py-3">Harga Aktif</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {kategori.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">Belum ada paket tenant.</td></tr>
            )}
            {kategori.map((k) => {
              const harga = hargaPerKategori.get(k.id)
              return (
                <tr key={k.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">{k.kode}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{k.nama}</p>
                    {k.keterangan && <p className="mt-0.5 max-w-md text-xs text-slate-500">{k.keterangan}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {k.include_listrik && <span className="rounded-md bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700">Listrik</span>}
                      {k.include_trashbag && <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">Trashbag</span>}
                      {!k.include_listrik && !k.include_trashbag && <span className="text-xs text-slate-400">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {harga != null ? (
                      <div>
                        <p className="font-bold text-primary-600">{formatRupiah(harga)}</p>
                        <p className="text-xs text-slate-400">{activePeriod?.nama ?? 'Periode berjalan'}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Belum diatur</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dankelola/tenants/harga/${k.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Kelola
                    </Link>
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
