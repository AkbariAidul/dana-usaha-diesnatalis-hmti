'use client'

import { DataError } from '@/components/data-error'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import type { KategoriSewa, HargaDasar, PeriodeHarga } from '@/lib/types'
import { periodeDariTanggal } from '@/lib/types'
import { kategoriTenant } from '@/lib/tenant'
import { formatRupiah, formatDate, todayISO } from '@/lib/utils'
import { useConfirm } from '@/components/confirm-dialog'

type Master = { kategori: KategoriSewa[]; hargaDasar: HargaDasar[]; periode: PeriodeHarga[] }

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'
const emptyPeriode = { id: '', nama: '', tanggal_mulai: '', tanggal_selesai: '' }

export default function HargaPage() {
  const confirm = useConfirm()
  const [kategori, setKategori] = useState<KategoriSewa[]>([])
  const [hargaDasar, setHargaDasar] = useState<HargaDasar[]>([])
  const [periods, setPeriods] = useState<PeriodeHarga[]>([])
  const [showPeriodForm, setShowPeriodForm] = useState(false)
  const [periodForm, setPeriodForm] = useState(emptyPeriode)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
  useLiveRefresh(load, 5000, !showPeriodForm && !saving)

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

  async function simpanPeriode() {
    if (!periodForm.nama || !periodForm.tanggal_mulai || !periodForm.tanggal_selesai) {
      toast.error('Nama dan tanggal periode wajib diisi')
      return
    }
    setSaving(true)
    try {
      await sendJSON('/api/master/periode', 'POST', {
        id: periodForm.id || undefined,
        nama: periodForm.nama,
        tanggal_mulai: periodForm.tanggal_mulai,
        tanggal_selesai: periodForm.tanggal_selesai,
      })
      toast.success(periodForm.id ? 'Periode diperbarui' : 'Periode ditambahkan')
      setShowPeriodForm(false)
      setPeriodForm(emptyPeriode)
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function hapusPeriode(p: PeriodeHarga) {
    const ok = await confirm({
      title: 'Hapus periode harga?',
      description: `Periode ${p.nama} dan semua harga pada periode ini ikut terhapus.`,
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      await sendJSON('/api/master/periode', 'DELETE', { id: p.id })
      toast.success('Periode dihapus')
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

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
        <button
          onClick={() => { setPeriodForm(emptyPeriode); setShowPeriodForm(true) }}
          className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700"
        >
          + Tambah Periode
        </button>
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

      {showPeriodForm && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold">{periodForm.id ? 'Edit Periode' : 'Tambah Periode'}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Nama Periode</label>
              <input className={input} placeholder="Early Bird" value={periodForm.nama} onChange={(e) => setPeriodForm({ ...periodForm, nama: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tanggal Mulai</label>
              <input type="date" className={input} value={periodForm.tanggal_mulai} onChange={(e) => setPeriodForm({ ...periodForm, tanggal_mulai: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tanggal Selesai</label>
              <input type="date" className={input} value={periodForm.tanggal_selesai} onChange={(e) => setPeriodForm({ ...periodForm, tanggal_selesai: e.target.value })} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowPeriodForm(false)} className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Batal</button>
            <button disabled={saving} onClick={simpanPeriode} className="rounded-xl bg-primary-600 px-4 py-2 text-sm text-white disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold">Periode Harga</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2">Nama</th>
                <th className="px-3 py-2">Mulai</th>
                <th className="px-3 py-2">Selesai</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {periods.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Belum ada periode harga.</td></tr>}
              {periods.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{p.nama}</td>
                  <td className="px-3 py-2">{formatDate(p.tanggal_mulai)}</td>
                  <td className="px-3 py-2">{formatDate(p.tanggal_selesai)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${p.kode === activeKode ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                      {p.kode === activeKode ? 'Berjalan' : 'Tidak aktif'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setPeriodForm({ id: p.id, nama: p.nama, tanggal_mulai: p.tanggal_mulai, tanggal_selesai: p.tanggal_selesai }); setShowPeriodForm(true) }}
                        className="text-primary-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button onClick={() => hapusPeriode(p)} className="text-red-600 hover:underline">Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
