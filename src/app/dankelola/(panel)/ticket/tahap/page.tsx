'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import type { TicketKatalogItem, TicketPeriode } from '@/lib/types'
import { formatRupiah, todayISO } from '@/lib/utils'

type FormState = {
  id?: string
  nama: string
  deskripsi: string
  harga: number
  jumlah_orang: number
  is_hari_h: boolean
  kuota: number
  selesai_jual: string
  aktif: boolean
}

type PeriodeForm = {
  id?: string
  tiket_tipe_id: string
  nama: string
  tanggal_mulai: string
  tanggal_selesai: string
  harga: number
}

function emptyForm(isHariH = false): FormState {
  return {
    nama: '',
    deskripsi: '',
    harga: 0,
    jumlah_orang: 1,
    is_hari_h: isHariH,
    kuota: isHariH ? 10 : 0,
    selesai_jual: '',
    aktif: true,
  }
}

function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TahapPage() {
  const [tiket, setTiket] = useState<TicketKatalogItem[]>([])
  const [periods, setPeriods] = useState<TicketPeriode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [showPeriodeForm, setShowPeriodeForm] = useState(false)
  const [periodeForm, setPeriodeForm] = useState<PeriodeForm>({
    tiket_tipe_id: '',
    nama: '',
    tanggal_mulai: '',
    tanggal_selesai: '',
    harga: 0,
  })

  const load = useCallback(async () => {
    const [t, p] = await Promise.all([
      getJSON<TicketKatalogItem[]>('/api/ticket'),
      getJSON<TicketPeriode[]>('/api/ticket/periode'),
    ])
    setTiket(t)
    setPeriods(p)
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

  function openCreate(isHariH = false) {
    setForm(emptyForm(isHariH))
    setShowForm(true)
  }

  function openEdit(t: TicketKatalogItem) {
    setForm({
      id: t.id,
      nama: t.nama,
      deskripsi: t.deskripsi ?? '',
      harga: Number(t.harga),
      jumlah_orang: Number(t.jumlah_orang ?? 1),
      is_hari_h: Boolean(t.is_hari_h),
      kuota: Number(t.kuota ?? 0) || 10,
      selesai_jual: toLocalInput(t.selesai_jual),
      aktif: t.aktif,
    })
    setShowForm(true)
  }

  function openPeriodeCreate(tipeId: string) {
    setPeriodeForm({ tiket_tipe_id: tipeId, nama: '', tanggal_mulai: '', tanggal_selesai: '', harga: 0 })
    setShowPeriodeForm(true)
  }

  function openPeriodeEdit(p: TicketPeriode) {
    setPeriodeForm({
      id: p.id,
      tiket_tipe_id: p.tiket_tipe_id,
      nama: p.nama ?? '',
      tanggal_mulai: p.tanggal_mulai,
      tanggal_selesai: p.tanggal_selesai,
      harga: Number(p.harga),
    })
    setShowPeriodeForm(true)
  }

  async function simpan() {
    if (!form.nama.trim() || !form.harga) {
      toast.error('Nama dan harga harus diisi')
      return
    }
    try {
      await sendJSON('/api/ticket', 'POST', {
        ...form,
        nama: form.nama.trim(),
        deskripsi: form.deskripsi.trim() || null,
        harga: Number(form.harga),
        jumlah_orang: Number(form.jumlah_orang) || 1,
        kuota: form.is_hari_h ? Number(form.kuota) || 10 : 0,
        selesai_jual:
          form.is_hari_h && form.selesai_jual ? new Date(form.selesai_jual).toISOString() : null,
      })
      toast.success(form.id ? 'Tipe tiket diperbarui' : 'Tipe tiket ditambahkan')
      setForm(emptyForm())
      setShowForm(false)
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function simpanPeriode() {
    if (!periodeForm.tiket_tipe_id) { toast.error('Pilih tipe tiket'); return }
    if (!periodeForm.tanggal_mulai || !periodeForm.tanggal_selesai) { toast.error('Tanggal wajib diisi'); return }
    if (periodeForm.tanggal_selesai < periodeForm.tanggal_mulai) { toast.error('Tanggal selesai harus setelah mulai'); return }
    if (!periodeForm.harga) { toast.error('Harga wajib diisi'); return }
    try {
      await sendJSON('/api/ticket/periode', 'POST', {
        ...periodeForm,
        nama: periodeForm.nama.trim() || null,
        harga: Number(periodeForm.harga),
      })
      toast.success(periodeForm.id ? 'Periode diperbarui' : 'Periode ditambahkan')
      setPeriodeForm({ tiket_tipe_id: '', nama: '', tanggal_mulai: '', tanggal_selesai: '', harga: 0 })
      setShowPeriodeForm(false)
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

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

  async function hapusPeriode(p: TicketPeriode) {
    if (!window.confirm('Hapus periode harga ini?')) return
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
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tipe & Harga</h1>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-600">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
        </div>
      </div>
    )

  const hariH = tiket.filter((t) => t.is_hari_h)
  const orderDibuka = tiket.filter((t) => t.buka).length
  const totalTerjualHariH = hariH.reduce((s, t) => s + Number(t.terjual ?? 0), 0)
  const today = todayISO()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tipe & Harga</h1>
          <p className="text-sm text-slate-500">Kelola tipe tiket, periode harga, dan penjualan Hari H.</p>
        </div>
        <button
          onClick={() => openCreate()}
          className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          + Tambah Tipe
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Tipe Tiket</p>
          <p className="text-3xl font-bold text-primary-600">{tiket.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Order Dibuka</p>
          <p className="text-3xl font-bold text-green-600">{orderDibuka}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Terjual Hari H</p>
          <p className="text-3xl font-bold text-orange-600">{totalTerjualHariH}</p>
        </div>
      </div>

      {/* Hari H section */}
      {hariH.length > 0 && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-slate-900">Tiket Hari H</h2>
              <p className="text-sm text-slate-500">Penjualan terbatas, otomatis berhenti saat kuota habis atau waktu tutup.</p>
            </div>
            <button
              onClick={() => openCreate(true)}
              className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white"
            >
              + Buat Tiket Hari H
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
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
                  <span className={`rounded-full px-2 py-0.5 text-xs ${t.buka ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {t.buka ? 'Dibuka' : 'Ditutup'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">Sisa {t.sisa ?? 0} tiket · {formatRupiah(Number(t.harga_aktif))}</p>
                <p className="text-xs text-slate-500">Tutup: {t.selesai_jual ? new Date(t.selesai_jual).toLocaleString('id-ID') : 'tanpa batas'}</p>
                <button onClick={() => openEdit(t)} className="mt-3 inline-block rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">Atur</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form tambah/edit tipe */}
      {showForm && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold">{form.id ? 'Edit Tipe Tiket' : 'Tambah Tipe Tiket'}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <input placeholder="Nama Tiket" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} />
            <input type="number" placeholder="Harga" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.harga || ''} onChange={e => setForm({ ...form, harga: Number(e.target.value) })} />
            <input type="number" min={1} placeholder="Jumlah orang" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.jumlah_orang} onChange={e => setForm({ ...form, jumlah_orang: Number(e.target.value) })} />
          </div>
          <div className="mt-3">
            <textarea placeholder="Deskripsi (opsional)" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.deskripsi} onChange={e => setForm({ ...form, deskripsi: e.target.value })} rows={2} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_hari_h} onChange={e => setForm({ ...form, is_hari_h: e.target.checked, kuota: e.target.checked ? form.kuota || 10 : 0 })} />
              Tiket Hari H (kuota terbatas)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.aktif} onChange={e => setForm({ ...form, aktif: e.target.checked })} />
              Buka order
            </label>
          </div>
          {form.is_hari_h && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input type="number" min={1} placeholder="Kuota" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.kuota} onChange={e => setForm({ ...form, kuota: Number(e.target.value) })} />
              <input type="datetime-local" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.selesai_jual} onChange={e => setForm({ ...form, selesai_jual: e.target.value })} />
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setForm(emptyForm()) }} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
            <button onClick={simpan} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-xl">Simpan</button>
          </div>
        </div>
      )}

      {/* Form tambah/edit periode */}
      {showPeriodeForm && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold">{periodeForm.id ? 'Edit Periode' : 'Tambah Periode Harga'}</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <select
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              value={periodeForm.tiket_tipe_id}
              onChange={e => setPeriodeForm({ ...periodeForm, tiket_tipe_id: e.target.value })}
            >
              <option value="">Pilih tipe tiket</option>
              {tiket.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}
            </select>
            <input placeholder="Nama periode (opsional)" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={periodeForm.nama} onChange={e => setPeriodeForm({ ...periodeForm, nama: e.target.value })} />
            <input type="date" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={periodeForm.tanggal_mulai} onChange={e => setPeriodeForm({ ...periodeForm, tanggal_mulai: e.target.value })} />
            <input type="date" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={periodeForm.tanggal_selesai} onChange={e => setPeriodeForm({ ...periodeForm, tanggal_selesai: e.target.value })} />
          </div>
          <div className="mt-3">
            <input type="number" min={0} placeholder="Harga" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={periodeForm.harga || ''} onChange={e => setPeriodeForm({ ...periodeForm, harga: Number(e.target.value) })} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => { setShowPeriodeForm(false); setPeriodeForm({ tiket_tipe_id: '', nama: '', tanggal_mulai: '', tanggal_selesai: '', harga: 0 }) }} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
            <button onClick={simpanPeriode} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-xl">Simpan</button>
          </div>
        </div>
      )}

      {/* Tabel tipe tiket + periode */}
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Tipe</th>
                <th className="px-3 py-2">Untuk</th>
                <th className="px-3 py-2">Harga</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Periode</th>
                <th className="px-3 py-2">Hari H</th>
                <th className="px-3 py-2">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {tiket.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Belum ada tipe tiket.</td></tr>
              )}
              {tiket.map((t) => {
                const tipePeriods = periods.filter(p => p.tiket_tipe_id === t.id)
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <div className="font-medium">{t.nama}</div>
                      {t.deskripsi && <div className="text-xs text-slate-500">{t.deskripsi}</div>}
                    </td>
                    <td className="px-3 py-2">{t.jumlah_orang} orang</td>
                    <td className="px-3 py-2">
                      <div>{formatRupiah(Number(t.harga_aktif))}</div>
                      {t.periode_aktif && <div className="text-xs text-slate-500">{t.periode_aktif.nama || 'aktif'}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${t.buka ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {t.buka ? 'Dibuka' : 'Ditutup'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {tipePeriods.length === 0 && <span className="text-slate-400">Harga dasar</span>}
                      <div className="space-y-0.5">
                        {tipePeriods.map(p => {
                          const aktif = today >= p.tanggal_mulai && today <= p.tanggal_selesai
                          return (
                            <div key={p.id} className="flex items-center gap-1 text-xs">
                              <span className={aktif ? 'text-green-700 font-medium' : 'text-slate-500'}>
                                {p.nama || 'Periode'} · {formatRupiah(Number(p.harga))}
                              </span>
                              <button onClick={() => openPeriodeEdit(p)} className="text-primary-600 hover:underline">Edit</button>
                              <button onClick={() => hapusPeriode(p)} className="text-red-600 hover:underline">Hapus</button>
                            </div>
                          )
                        })}
                      </div>
                      <button onClick={() => openPeriodeCreate(t.id)} className="mt-1 text-xs text-primary-600 hover:underline">+ Periode</button>
                    </td>
                    <td className="px-3 py-2">
                      {t.is_hari_h ? (
                        <div>
                          <p>{Number(t.terjual ?? 0) + Number(t.pending ?? 0)} / {t.kuota}</p>
                          <p className="text-xs text-slate-500">Sisa {t.sisa ?? 0}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => openEdit(t)} className="text-primary-600 hover:underline">Edit</button>
                        <button onClick={() => toggle(t)} className="text-slate-600 hover:underline">{t.aktif ? 'Tutup' : 'Buka'}</button>
                        <button onClick={() => hapus(t)} className="text-red-600 hover:underline">Hapus</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
