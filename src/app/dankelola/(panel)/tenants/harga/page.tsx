'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import type { KategoriSewa, HargaDasar, FaktorHarga, PeriodeHarga, Peralatan, KomposisiPeralatan } from '@/lib/types'
import { periodeDariTanggal } from '@/lib/types'
import { formatRupiah, formatDate } from '@/lib/utils'

type Master = { kategori: KategoriSewa[]; hargaDasar: HargaDasar[]; faktor: FaktorHarga[]; periode: PeriodeHarga[] }

const TIPE = ['F&B', 'Non-F&B'] as const
const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10'
const emptyPeriode = { id: '', nama: '', tanggal_mulai: '', tanggal_selesai: '' }

export default function HargaPage() {
  const [kategori, setKategori] = useState<KategoriSewa[]>([])
  const [hargaDasar, setHargaDasar] = useState<HargaDasar[]>([])
  const [faktor, setFaktor] = useState<FaktorHarga[]>([])
  const [periods, setPeriods] = useState<PeriodeHarga[]>([])
  const [peralatan, setPeralatan] = useState<Peralatan[]>([])
  const [komposisi, setKomposisi] = useState<KomposisiPeralatan>({})
  const [komposisiEdits, setKomposisiEdits] = useState<Record<string, string>>({})
  const [selectedId, setSelectedId] = useState('')
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [showPeriodForm, setShowPeriodForm] = useState(false)
  const [periodForm, setPeriodForm] = useState(emptyPeriode)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingKomposisi, setSavingKomposisi] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty =
    Object.keys(edits).length > 0 ||
    Object.keys(komposisiEdits).length > 0 ||
    showPeriodForm ||
    saving ||
    savingKomposisi
  const dirtyRef = useRef(false)

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  const load = useCallback(async (force = false) => {
    const [m, items, komp] = await Promise.all([
      getJSON<Master>('/api/master'),
      getJSON<Peralatan[]>('/api/peralatan'),
      getJSON<KomposisiPeralatan>('/api/peralatan/komposisi'),
    ])
    if (!force && dirtyRef.current) return
    const list = m.periode || []
    setKategori(m.kategori || [])
    setHargaDasar(m.hargaDasar || [])
    setFaktor(m.faktor || [])
    setPeriods(list)
    setPeralatan(items || [])
    setKomposisi(komp || {})
    setKomposisiEdits({})
    setSelectedId((prev) => (prev && list.some((p) => p.id === prev) ? prev : list[0]?.id ?? ''))
  }, [])

  useEffect(() => {
    load()
      .catch((e) => {
        console.error('Failed to load master data:', e)
        setError('Gagal memuat data master')
      })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load, 5000, !dirty)

  useEffect(() => { setEdits({}) }, [selectedId, hargaDasar])

  const selected = periods.find((p) => p.id === selectedId)
  const today = new Date().toISOString().slice(0, 10)
  const activeKode = periodeDariTanggal(today, periods)

  const hargaByKey = useMemo(() => {
    const map = new Map<string, HargaDasar>()
    for (const h of hargaDasar) {
      if (h.periode === selected?.kode) map.set(`${h.kategori_sewa_id}|${h.jenis_usaha}`, h)
    }
    return map
  }, [hargaDasar, selected])

  const modalByKategori = useMemo(() => {
    const map = new Map<string, number>()
    for (const k of kategori) {
      let total = 0
      for (const item of peralatan) total += qtyKomposisi(k.id, item.id) * item.harga_satuan
      map.set(k.id, total)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kategori, komposisi, komposisiEdits, peralatan])

  function qtyKomposisi(kategoriId: string, peralatanId: string) {
    const key = `${kategoriId}|${peralatanId}`
    if (komposisiEdits[key] !== undefined) return Number(komposisiEdits[key]) || 0
    return komposisi[kategoriId]?.[peralatanId] || 0
  }

  async function simpanKomposisi() {
    const next: KomposisiPeralatan = {}
    for (const k of kategori) {
      const row: Record<string, number> = {}
      for (const item of peralatan) {
        const qty = qtyKomposisi(k.id, item.id)
        if (qty > 0) row[item.id] = qty
      }
      if (Object.keys(row).length > 0) next[k.id] = row
    }
    setSavingKomposisi(true)
    try {
      const saved = await sendJSON('/api/peralatan/komposisi', 'POST', next) as KomposisiPeralatan
      setKomposisi(saved)
      setKomposisiEdits({})
      toast.success('Komposisi modal paket disimpan')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingKomposisi(false)
    }
  }

  async function simpanPeriode() {
    if (!periodForm.nama || !periodForm.tanggal_mulai || !periodForm.tanggal_selesai) {
      toast.error('Nama dan tanggal periode wajib diisi')
      return
    }
    setSaving(true)
    try {
      const saved = await sendJSON('/api/master/periode', 'POST', {
        id: periodForm.id || undefined,
        nama: periodForm.nama,
        tanggal_mulai: periodForm.tanggal_mulai,
        tanggal_selesai: periodForm.tanggal_selesai,
      }) as PeriodeHarga
      toast.success(periodForm.id ? 'Periode diperbarui' : 'Periode ditambahkan')
      setShowPeriodForm(false)
      setPeriodForm(emptyPeriode)
      await load(true)
      setSelectedId(saved.id)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function hapusPeriode(p: PeriodeHarga) {
    if (!confirm(`Hapus periode ${p.nama}? Semua harga pada periode ini ikut terhapus.`)) return
    try {
      await sendJSON('/api/master/periode', 'DELETE', { id: p.id })
      toast.success('Periode dihapus')
      setSelectedId('')
      await load(true)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function simpanHarga() {
    if (!selected) return
    const rows: Array<Partial<HargaDasar>> = []
    for (const k of kategori) {
      for (const jenis of TIPE) {
        const key = `${k.id}|${jenis}`
        if (edits[key] === undefined || edits[key].trim() === '') continue
        const value = Number(edits[key])
        if (!Number.isFinite(value) || value < 0) {
          toast.error('Harga tidak valid')
          return
        }
        const existing = hargaByKey.get(key)
        if (existing && existing.harga === value) continue
        rows.push({ id: existing?.id, kategori_sewa_id: k.id, jenis_usaha: jenis, periode: selected.kode, harga: value })
      }
    }
    if (rows.length === 0) {
      toast.info('Tidak ada perubahan harga')
      return
    }
    setSaving(true)
    try {
      await Promise.all(rows.map((r) => sendJSON('/api/master/harga', 'POST', r)))
      toast.success('Harga disimpan')
      await load(true)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Paket & Harga</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Paket & Harga</h1>
        <button
          onClick={() => { setPeriodForm(emptyPeriode); setShowPeriodForm(true) }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700"
        >
          + Tambah Periode
        </button>
      </div>

      {showPeriodForm && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <h2 className="font-semibold mb-4">{periodForm.id ? 'Edit Periode' : 'Tambah Periode'}</h2>
          <div className="grid md:grid-cols-3 gap-3">
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
            <button onClick={() => setShowPeriodForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
            <button disabled={saving} onClick={simpanPeriode} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
        <h2 className="font-semibold mb-4">Periode Harga</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Nama</th>
                <th className="px-3 py-2 text-left">Mulai</th>
                <th className="px-3 py-2 text-left">Selesai</th>
                <th className="px-3 py-2 text-left">Status</th>
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
                    <span className={`px-2 py-0.5 rounded text-xs ${p.kode === activeKode ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                      {p.kode === activeKode ? 'Berjalan' : 'Tidak aktif'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setPeriodForm({ id: p.id, nama: p.nama, tanggal_mulai: p.tanggal_mulai, tanggal_selesai: p.tanggal_selesai }); setShowPeriodForm(true) }}
                        className="text-indigo-600 hover:underline"
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

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Harga per Kategori</h2>
            <p className="text-sm text-slate-500">{selected ? `${selected.nama} · ${formatDate(selected.tanggal_mulai)} – ${formatDate(selected.tanggal_selesai)}` : 'Pilih periode terlebih dahulu'}</p>
          </div>
          <div className="flex items-center gap-2">
            <select className={`${input} w-auto`} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {periods.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
            </select>
            <button disabled={!selected || saving} onClick={simpanHarga} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
              Simpan Harga
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Kategori</th>
                {TIPE.map((t) => <th key={t} className="px-3 py-2 text-right">{t}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {kategori.map((k) => (
                <tr key={k.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{k.nama}</p>
                    <p className="font-mono text-xs text-slate-400">{k.kode}</p>
                  </td>
                  {TIPE.map((jenis) => {
                    const key = `${k.id}|${jenis}`
                    const existing = hargaByKey.get(key)
                    return (
                      <td key={jenis} className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          disabled={!selected}
                          className={`${input} text-right disabled:bg-slate-50`}
                          placeholder="Belum diatur"
                          value={edits[key] ?? (existing ? String(existing.harga) : '')}
                          onChange={(e) => setEdits({ ...edits, [key]: e.target.value })}
                        />
                        {existing && <p className="mt-1 text-right text-xs text-slate-400">{formatRupiah(existing.harga)}</p>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
        <div className="mb-4">
          <h2 className="font-semibold">Komposisi Modal Paket</h2>
          <p className="text-sm text-slate-500">Isi jumlah barang yang dipakai tiap paket. Modal dihitung dari harga sewa vendor.</p>
        </div>
        {peralatan.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Belum ada barang sewa. Tambahkan dulu di <Link href="/dankelola/tenants/peralatan" className="text-indigo-600 hover:underline">Sewa Vendor</Link>.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Barang</th>
                    <th className="px-3 py-2 text-right">Harga / Unit</th>
                    {kategori.map((k) => <th key={k.id} className="px-3 py-2 text-center">{k.nama}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {peralatan.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">
                        <p className="font-medium">{item.nama}</p>
                        <p className="text-xs text-slate-400">{item.jenis}{item.vendor ? ` · ${item.vendor}` : ''}</p>
                      </td>
                      <td className="px-3 py-2 text-right">{formatRupiah(item.harga_satuan)}</td>
                      {kategori.map((k) => {
                        const key = `${k.id}|${item.id}`
                        return (
                          <td key={k.id} className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              className={`${input} w-20 text-center`}
                              placeholder="0"
                              value={komposisiEdits[key] ?? (komposisi[k.id]?.[item.id] ? String(komposisi[k.id][item.id]) : '')}
                              onChange={(e) => setKomposisiEdits({ ...komposisiEdits, [key]: e.target.value })}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold">
                  <tr>
                    <td className="px-3 py-2" colSpan={2}>Modal per Paket</td>
                    {kategori.map((k) => <td key={k.id} className="px-3 py-2 text-center">{formatRupiah(modalByKategori.get(k.id) || 0)}</td>)}
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <button disabled={savingKomposisi} onClick={simpanKomposisi} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                {savingKomposisi ? 'Menyimpan...' : 'Simpan Komposisi'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
        <div className="mb-4">
          <h2 className="font-semibold">Keuntungan per Paket</h2>
          <p className="text-sm text-slate-500">
            {selected ? `${selected.nama} · harga jual dikurangi modal paket` : 'Pilih periode terlebih dahulu'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Kategori</th>
                <th className="px-3 py-2 text-right">Modal Paket</th>
                {TIPE.map((t) => <th key={t} className="px-3 py-2 text-right">{t}</th>)}
                {TIPE.map((t) => <th key={`${t}-laba`} className="px-3 py-2 text-right">Untung {t}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {kategori.map((k) => {
                const modal = modalByKategori.get(k.id) || 0
                return (
                  <tr key={k.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium">{k.nama}</p>
                      <p className="font-mono text-xs text-slate-400">{k.kode}</p>
                    </td>
                    <td className="px-3 py-2 text-right">{formatRupiah(modal)}</td>
                    {TIPE.map((jenis) => {
                      const harga = hargaByKey.get(`${k.id}|${jenis}`)
                      return <td key={jenis} className="px-3 py-2 text-right">{harga ? formatRupiah(harga.harga) : <span className="text-slate-400">-</span>}</td>
                    })}
                    {TIPE.map((jenis) => {
                      const harga = hargaByKey.get(`${k.id}|${jenis}`)
                      if (!harga) return <td key={`${jenis}-laba`} className="px-3 py-2 text-right text-slate-400">-</td>
                      const laba = harga.harga - modal
                      return (
                        <td key={`${jenis}-laba`} className={`px-3 py-2 text-right font-semibold ${laba >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatRupiah(laba)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
        <h2 className="font-semibold mb-4">Kategori Sewa</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Kode</th>
                <th className="px-3 py-2 text-left">Nama</th>
                <th className="px-3 py-2 text-left">Listrik</th>
                <th className="px-3 py-2 text-left">Trashbag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {kategori.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Belum ada kategori sewa.</td></tr>}
              {kategori.map((k) => (
                <tr key={k.id}>
                  <td className="px-3 py-2 font-mono text-xs">{k.kode}</td>
                  <td className="px-3 py-2">{k.nama}</td>
                  <td className="px-3 py-2">{k.include_listrik ? '✓' : '-'}</td>
                  <td className="px-3 py-2">{k.include_trashbag ? '✓' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
        <h2 className="font-semibold mb-4">Faktor Penyesuaian Harga</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Tipe</th>
                <th className="px-3 py-2 text-left">Nilai</th>
                <th className="px-3 py-2 text-right">Multiplier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {faktor.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-400">Belum ada faktor harga.</td></tr>}
              {faktor.map((f) => (
                <tr key={f.id}>
                  <td className="px-3 py-2 capitalize">{f.tipe}</td>
                  <td className="px-3 py-2">{f.nilai}</td>
                  <td className="px-3 py-2 text-right font-mono">{f.multiplier}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
