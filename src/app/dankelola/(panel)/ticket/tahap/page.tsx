'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import type { TicketKatalogItem, TicketPeriode, TicketBundleDiscount } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'

type PeriodForm = {
  id?: string
  nama: string
  tanggal_mulai: string
  tanggal_selesai: string
  harga: number
}

type BundleForm = {
  id?: string
  jumlah_min: number
  diskon_persen: number
}

export default function TahapPage() {
  const [tiket, setTiket] = useState<TicketKatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state for ticket type
  const [formOpen, setFormOpen] = useState(false)
  const [formId, setFormId] = useState('')
  const [formNama, setFormNama] = useState('')
  const [formDeskripsi, setFormDeskripsi] = useState('')
  const [formHarga, setFormHarga] = useState(0)
  const [formJumlahOrang, setFormJumlahOrang] = useState(1)
  const [formAktif, setFormAktif] = useState(true)
  const [formHariH, setFormHariH] = useState(false)
  const [formKuota, setFormKuota] = useState(10)
  const [formSelesaiJual, setFormSelesaiJual] = useState('')

  // Period forms per ticket
  const [periods, setPeriods] = useState<Record<string, PeriodForm[]>>({})
  const [editingPeriod, setEditingPeriod] = useState<{ tipeId: string; periodId?: string } | null>(null)
  const [periodForm, setPeriodForm] = useState<PeriodForm>({ nama: '', tanggal_mulai: '', tanggal_selesai: '', harga: 0 })

  // Bundle discount forms per ticket
  const [bundles, setBundles] = useState<Record<string, BundleForm[]>>({})
  const [editingBundle, setEditingBundle] = useState<{ tipeId: string; bundleId?: string } | null>(null)
  const [bundleForm, setBundleForm] = useState<BundleForm>({ jumlah_min: 2, diskon_persen: 0 })

  const load = useCallback(async () => {
    const t = await getJSON<TicketKatalogItem[]>('/api/ticket')
    const [allPeriods, allBundles] = await Promise.all([
      getJSON<TicketPeriode[]>('/api/ticket/periode'),
      getJSON<TicketBundleDiscount[]>('/api/ticket/bundle'),
    ])
    setTiket(t)
    setError(null)

    // Group periods by tipe_id
    const pMap: Record<string, PeriodForm[]> = {}
    for (const p of allPeriods) {
      if (!pMap[p.tiket_tipe_id]) pMap[p.tiket_tipe_id] = []
      pMap[p.tiket_tipe_id].push({ nama: p.nama ?? '', tanggal_mulai: p.tanggal_mulai, tanggal_selesai: p.tanggal_selesai, harga: Number(p.harga), id: p.id })
    }
    setPeriods(pMap)

    // Group bundles by tipe_id
    const bMap: Record<string, BundleForm[]> = {}
    for (const b of allBundles) {
      if (!bMap[b.tiket_tipe_id]) bMap[b.tiket_tipe_id] = []
      bMap[b.tiket_tipe_id].push({ jumlah_min: b.jumlah_min, diskon_persen: Number(b.diskon_persen), id: b.id })
    }
    setBundles(bMap)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => { setError('Gagal memuat data tiket'); console.error(e) })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  function openCreate() {
    resetForm()
    setFormOpen(true)
  }

  function openEdit(t: TicketKatalogItem) {
    setFormId(t.id)
    setFormNama(t.nama)
    setFormDeskripsi(t.deskripsi ?? '')
    setFormHarga(Number(t.harga))
    setFormJumlahOrang(Number(t.jumlah_orang ?? 1))
    setFormAktif(t.aktif)
    setFormHariH(t.is_hari_h)
    setFormKuota(Number(t.kuota ?? 0) || 10)
    setFormSelesaiJual(t.selesai_jual ? new Date(t.selesai_jual).toLocaleString('sv-SE').slice(0, 16) : '')
    setFormOpen(true)
  }

  function resetForm() {
    setFormId('')
    setFormNama('')
    setFormDeskripsi('')
    setFormHarga(0)
    setFormJumlahOrang(1)
    setFormAktif(true)
    setFormHariH(false)
    setFormKuota(10)
    setFormSelesaiJual('')
  }

  async function simpanTiket() {
    if (!formNama.trim() || !formHarga) { toast.error('Nama dan harga wajib diisi'); return }
    try {
      await sendJSON('/api/ticket', 'POST', {
        id: formId || undefined,
        nama: formNama.trim(),
        deskripsi: formDeskripsi.trim() || null,
        harga: Number(formHarga),
        jumlah_orang: Number(formJumlahOrang) || 1,
        aktif: formAktif,
        is_hari_h: formHariH,
        kuota: formHariH ? Number(formKuota) || 10 : 0,
        selesai_jual: formHariH && formSelesaiJual ? new Date(formSelesaiJual).toISOString() : null,
      })
      toast.success(formId ? 'Tipe tiket diperbarui' : 'Tipe tiket ditambahkan')
      setFormOpen(false)
      resetForm()
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }

  async function hapusTiket(t: TicketKatalogItem) {
    if (!window.confirm(`Hapus tipe ${t.nama}?`)) return
    try {
      await sendJSON('/api/ticket', 'DELETE', { id: t.id })
      toast.success('Tipe tiket dihapus')
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }

  async function toggleTiket(t: TicketKatalogItem) {
    try {
      await sendJSON('/api/ticket', 'POST', { id: t.id, aktif: !t.aktif })
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }

  // Period actions
  function openPeriodForm(tipeId: string, period?: PeriodForm) {
    setEditingPeriod({ tipeId, periodId: period?.id })
    setPeriodForm(period ?? { nama: '', tanggal_mulai: '', tanggal_selesai: '', harga: 0 })
  }
  function closePeriodForm() { setEditingPeriod(null) }

  async function simpanPeriode() {
    if (!editingPeriod) return
    if (!periodForm.tanggal_mulai || !periodForm.tanggal_selesai || !periodForm.harga) {
      toast.error('Tanggal dan harga periode wajib diisi')
      return
    }
    if (periodForm.tanggal_selesai < periodForm.tanggal_mulai) { toast.error('Tanggal selesai harus setelah mulai'); return }
    try {
      await sendJSON('/api/ticket/periode', 'POST', {
        id: periodForm.id,
        tiket_tipe_id: editingPeriod.tipeId,
        nama: periodForm.nama.trim() || null,
        tanggal_mulai: periodForm.tanggal_mulai,
        tanggal_selesai: periodForm.tanggal_selesai,
        harga: Number(periodForm.harga),
      })
      toast.success(periodForm.id ? 'Periode diperbarui' : 'Periode ditambahkan')
      closePeriodForm()
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }

  async function hapusPeriode(periodId: string) {
    if (!window.confirm('Hapus periode ini?')) return
    try {
      await sendJSON('/api/ticket/periode', 'DELETE', { id: periodId })
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }

  // Bundle actions
  function openBundleForm(tipeId: string, bundle?: BundleForm) {
    setEditingBundle({ tipeId, bundleId: bundle?.id })
    setBundleForm(bundle ?? { jumlah_min: 2, diskon_persen: 0 })
  }
  function closeBundleForm() { setEditingBundle(null) }

  async function simpanBundle() {
    if (!editingBundle) return
    if (!bundleForm.jumlah_min || bundleForm.jumlah_min < 2) { toast.error('Jumlah minimal minimal 2'); return }
    if (bundleForm.diskon_persen === undefined || bundleForm.diskon_persen < 0) { toast.error('Diskon tidak valid'); return }
    try {
      await sendJSON('/api/ticket/bundle', 'POST', {
        id: bundleForm.id,
        tiket_tipe_id: editingBundle.tipeId,
        jumlah_min: Number(bundleForm.jumlah_min),
        diskon_persen: Number(bundleForm.diskon_persen),
      })
      toast.success(bundleForm.id ? 'Diskon bundle diperbarui' : 'Diskon bundle ditambahkan')
      closeBundleForm()
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }

  async function hapusBundle(bundleId: string) {
    if (!window.confirm('Hapus diskon bundle ini?')) return
    try {
      await sendJSON('/api/ticket/bundle', 'DELETE', { id: bundleId })
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }

  const input = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'
  const label = 'mb-1 block text-xs font-medium text-slate-500'

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tipe & Harga</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  const hariH = tiket.filter((t) => t.is_hari_h)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tipe & Harga</h1>
          <p className="text-sm text-slate-500">Kelola tiket, periode harga, dan diskon bundle.</p>
        </div>
        <button onClick={openCreate} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">+ Tambah Tipe</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Tipe Tiket</p>
          <p className="text-3xl font-bold text-primary-600">{tiket.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Order Dibuka</p>
          <p className="text-3xl font-bold text-green-600">{tiket.filter((t) => t.buka).length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Terjual Hari H</p>
          <p className="text-3xl font-bold text-orange-600">{hariH.reduce((s, t) => s + Number(t.terjual ?? 0), 0)}</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FORM TAMBAH / EDIT TIPE                                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      {formOpen && (
        <div className="rounded-2xl border border-primary-200 bg-primary-50/40 p-6">
          <h2 className="mb-4 font-semibold text-slate-900">{formId ? 'Edit Tipe Tiket' : 'Tambah Tipe Tiket'}</h2>

          {/* Basic info */}
          <div className="grid gap-3 md:grid-cols-3">
            <div><label className={label}>Nama Tiket</label><input className={input} value={formNama} onChange={e => setFormNama(e.target.value)} placeholder="Contoh: Reguler" /></div>
            <div><label className={label}>Harga Dasar (Rp)</label><input type="number" min={0} className={input} value={formHarga || ''} onChange={e => setFormHarga(Number(e.target.value))} /></div>
            <div><label className={label}>Berlaku untuk (orang)</label><input type="number" min={1} className={input} value={formJumlahOrang} onChange={e => setFormJumlahOrang(Number(e.target.value))} /></div>
          </div>
          <div className="mt-3"><label className={label}>Deskripsi</label><textarea className={input} rows={2} value={formDeskripsi} onChange={e => setFormDeskripsi(e.target.value)} placeholder="Opsional" /></div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formAktif} onChange={e => setFormAktif(e.target.checked)} /> <span>Buka order</span></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formHariH} onChange={e => setFormHariH(e.target.checked)} /> <span>Tiket Hari H (kuota terbatas)</span></label>
          </div>

          {formHariH && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div><label className={label}>Kuota</label><input type="number" min={1} className={input} value={formKuota} onChange={e => setFormKuota(Number(e.target.value))} /></div>
              <div><label className={label}>Tutup Penjualan</label><input type="datetime-local" className={input} value={formSelesaiJual} onChange={e => setFormSelesaiJual(e.target.value)} /></div>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => { setFormOpen(false); resetForm() }} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
            <button onClick={simpanTiket} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-xl">Simpan</button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* CARD TIAP TIPE                                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      {tiket.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-400">Belum ada tipe tiket. Klik + Tambah Tipe untuk memulai.</p>
        </div>
      )}

      {tiket.map((t) => {
        const tPeriods = periods[t.id] ?? []
        const tBundles = bundles[t.id] ?? []
        return (
          <div key={t.id} className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="flex items-start gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{t.nama}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${t.buka ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{t.buka ? 'Dibuka' : 'Ditutup'}</span>
                    {t.is_hari_h && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">Hari H</span>}
                  </div>
                  {t.deskripsi && <p className="mt-0.5 text-xs text-slate-500">{t.deskripsi}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-lg font-bold text-primary-600">{formatRupiah(Number(t.harga_aktif))}</span>
                <button onClick={() => toggleTiket(t)} className="text-xs text-slate-500 hover:text-slate-700 underline">{t.aktif ? 'Tutup' : 'Buka'}</button>
                <button onClick={() => openEdit(t)} className="text-xs text-primary-600 hover:underline">Edit</button>
                <button onClick={() => hapusTiket(t)} className="text-xs text-red-500 hover:underline">Hapus</button>
              </div>
            </div>

            <div className="grid md:grid-cols-2">
              {/* Periods */}
              <div className="border-r border-slate-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Periode Harga</h4>
                  <button onClick={() => openPeriodForm(t.id)} className="text-xs text-primary-600 hover:underline">+ Tambah</button>
                </div>

                {/* Period form */}
                {editingPeriod?.tipeId === t.id && editingPeriod.periodId === undefined && (
                  <div className="mb-3 rounded-xl border border-primary-200 bg-primary-50/30 p-3 space-y-2">
                    <input className={input} placeholder="Nama periode (opsional)" value={periodForm.nama} onChange={e => setPeriodForm({ ...periodForm, nama: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className={label}>Mulai</label><input type="date" className={input} value={periodForm.tanggal_mulai} onChange={e => setPeriodForm({ ...periodForm, tanggal_mulai: e.target.value })} /></div>
                      <div><label className={label}>Selesai</label><input type="date" className={input} value={periodForm.tanggal_selesai} onChange={e => setPeriodForm({ ...periodForm, tanggal_selesai: e.target.value })} /></div>
                    </div>
                    <div><label className={label}>Harga</label><input type="number" min={0} className={input} value={periodForm.harga || ''} onChange={e => setPeriodForm({ ...periodForm, harga: Number(e.target.value) })} /></div>
                    <div className="flex justify-end gap-2">
                      <button onClick={closePeriodForm} className="text-xs text-slate-500 hover:text-slate-700">Batal</button>
                      <button onClick={simpanPeriode} className="rounded-lg bg-primary-600 px-3 py-1 text-xs text-white">Simpan</button>
                    </div>
                  </div>
                )}
                {editingPeriod?.tipeId === t.id && editingPeriod.periodId && (
                  <div className="mb-3 rounded-xl border border-primary-200 bg-primary-50/30 p-3 space-y-2">
                    <input className={input} placeholder="Nama periode" value={periodForm.nama} onChange={e => setPeriodForm({ ...periodForm, nama: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className={label}>Mulai</label><input type="date" className={input} value={periodForm.tanggal_mulai} onChange={e => setPeriodForm({ ...periodForm, tanggal_mulai: e.target.value })} /></div>
                      <div><label className={label}>Selesai</label><input type="date" className={input} value={periodForm.tanggal_selesai} onChange={e => setPeriodForm({ ...periodForm, tanggal_selesai: e.target.value })} /></div>
                    </div>
                    <div><label className={label}>Harga</label><input type="number" min={0} className={input} value={periodForm.harga || ''} onChange={e => setPeriodForm({ ...periodForm, harga: Number(e.target.value) })} /></div>
                    <div className="flex justify-end gap-2">
                      <button onClick={closePeriodForm} className="text-xs text-slate-500 hover:text-slate-700">Batal</button>
                      <button onClick={simpanPeriode} className="rounded-lg bg-primary-600 px-3 py-1 text-xs text-white">Simpan</button>
                    </div>
                  </div>
                )}

                {tPeriods.length === 0 ? (
                  <p className="text-xs text-slate-400">Menggunakan harga dasar {formatRupiah(Number(t.harga))}</p>
                ) : (
                  <div className="space-y-1.5">
                    {tPeriods.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50">
                        <div>
                          <span className="font-medium text-slate-700">{p.nama || 'Periode'}</span>
                          <span className="ml-2 text-slate-400">{p.tanggal_mulai} — {p.tanggal_selesai}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-primary-600">{formatRupiah(Number(p.harga))}</span>
                          <button onClick={() => openPeriodForm(t.id, p)} className="text-primary-500 hover:text-primary-700">Edit</button>
                          <button onClick={() => hapusPeriode(p.id!)} className="text-red-400 hover:text-red-600">Hapus</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bundle discounts */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Diskon Bundle</h4>
                  <button onClick={() => openBundleForm(t.id)} className="text-xs text-primary-600 hover:underline">+ Tambah</button>
                </div>

                {/* Bundle form */}
                {editingBundle?.tipeId === t.id && !editingBundle.bundleId && (
                  <div className="mb-3 rounded-xl border border-primary-200 bg-primary-50/30 p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className={label}>Beli minimal</label><input type="number" min={2} className={input} value={bundleForm.jumlah_min} onChange={e => setBundleForm({ ...bundleForm, jumlah_min: Number(e.target.value) })} /></div>
                      <div><label className={label}>Diskon (%)</label><input type="number" min={0} max={100} className={input} value={bundleForm.diskon_persen} onChange={e => setBundleForm({ ...bundleForm, diskon_persen: Number(e.target.value) })} /></div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={closeBundleForm} className="text-xs text-slate-500 hover:text-slate-700">Batal</button>
                      <button onClick={simpanBundle} className="rounded-lg bg-primary-600 px-3 py-1 text-xs text-white">Simpan</button>
                    </div>
                  </div>
                )}
                {editingBundle?.tipeId === t.id && editingBundle.bundleId && (
                  <div className="mb-3 rounded-xl border border-primary-200 bg-primary-50/30 p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className={label}>Beli minimal</label><input type="number" min={2} className={input} value={bundleForm.jumlah_min} onChange={e => setBundleForm({ ...bundleForm, jumlah_min: Number(e.target.value) })} /></div>
                      <div><label className={label}>Diskon (%)</label><input type="number" min={0} max={100} className={input} value={bundleForm.diskon_persen} onChange={e => setBundleForm({ ...bundleForm, diskon_persen: Number(e.target.value) })} /></div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={closeBundleForm} className="text-xs text-slate-500 hover:text-slate-700">Batal</button>
                      <button onClick={simpanBundle} className="rounded-lg bg-primary-600 px-3 py-1 text-xs text-white">Simpan</button>
                    </div>
                  </div>
                )}

                {tBundles.length === 0 ? (
                  <p className="text-xs text-slate-400">Tidak ada diskon bundle.</p>
                ) : (
                  <div className="space-y-1.5">
                    {tBundles.map((b) => (
                      <div key={b.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50">
                        <span className="text-slate-700">Beli <strong>{b.jumlah_min}</strong>+ ticket → <strong className="text-green-600">{b.diskon_persen}%</strong> diskon</span>
                        <div className="flex gap-2">
                          <button onClick={() => openBundleForm(t.id, b)} className="text-primary-500 hover:text-primary-700">Edit</button>
                          <button onClick={() => hapusBundle(b.id!)} className="text-red-400 hover:text-red-600">Hapus</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
