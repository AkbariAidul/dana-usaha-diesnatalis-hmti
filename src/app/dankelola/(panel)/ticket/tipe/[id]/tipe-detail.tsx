'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../../api'
import type { TicketKatalogItem, TicketPeriode, TicketBundleDiscount } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'

type FormState = {
  nama: string
  deskripsi: string
  harga: number
  jumlah_orang: number
  aktif: boolean
  is_hari_h: boolean
  kuota: number
  selesai_jual: string
}

function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TipeDetail({
  params,
  readOnly = false,
}: {
  params: Promise<{ id: string }>
  readOnly?: boolean
}) {
  const router = useRouter()
  const [ticket, setTicket] = useState<TicketKatalogItem | null>(null)
  const [periods, setPeriods] = useState<TicketPeriode[]>([])
  const [bundles, setBundles] = useState<TicketBundleDiscount[]>([])
  const [form, setForm] = useState<FormState>({ nama: '', deskripsi: '', harga: 0, jumlah_orang: 1, aktif: true, is_hari_h: false, kuota: 10, selesai_jual: '' })
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [bundleMin, setBundleMin] = useState(2)
  const [bundleDiskon, setBundleDiskon] = useState(0)
  const [bundleSubmitting, setBundleSubmitting] = useState(false)

  useEffect(() => {
    ;(async () => {
      const resolved = await params
      const [tipe, allPeriods, allBundles] = await Promise.all([
        getJSON<TicketKatalogItem[]>('/api/ticket'),
        getJSON<TicketPeriode[]>('/api/ticket/periode'),
        getJSON<TicketBundleDiscount[]>('/api/ticket/bundle'),
      ])
      const found = (tipe as TicketKatalogItem[]).find((t) => t.id === resolved.id)
      if (!found) { toast.error('Tipe tiket tidak ditemukan'); router.push('/dankelola/ticket/tahap'); return }
      setTicket(found)
      setPeriods(allPeriods as TicketPeriode[])
      setBundles(allBundles as TicketBundleDiscount[])
      setForm({
        nama: found.nama,
        deskripsi: found.deskripsi ?? '',
        harga: Number(found.harga),
        jumlah_orang: Number(found.jumlah_orang ?? 1),
        aktif: found.aktif,
        is_hari_h: Boolean(found.is_hari_h),
        kuota: Number(found.kuota ?? 0) || 10,
        selesai_jual: toLocalInput(found.selesai_jual),
      })
      setLoading(false)
    })()
  }, [params, router])

  async function simpan() {
    if (!ticket) return
    if (!form.nama.trim() || !form.harga) { toast.error('Nama dan harga wajib diisi'); return }
    setSubmitting(true)
    try {
      await sendJSON('/api/ticket', 'POST', {
        id: ticket.id,
        nama: form.nama.trim(),
        deskripsi: form.deskripsi.trim() || null,
        harga: Number(form.harga),
        jumlah_orang: Number(form.jumlah_orang) || 1,
        aktif: form.aktif,
        is_hari_h: form.is_hari_h,
        kuota: form.is_hari_h ? Number(form.kuota) || 10 : 0,
        selesai_jual: form.is_hari_h && form.selesai_jual ? new Date(form.selesai_jual).toISOString() : null,
      })
      toast.success('Tipe tiket diperbarui')
      router.push('/dankelola/ticket/tahap')
    } catch (e) { toast.error(String(e)) } finally { setSubmitting(false) }
  }

  async function hapus() {
    if (!ticket || !window.confirm(`Hapus tipe ${ticket.nama}? Semua data terkait akan dihapus.`)) return
    try {
      await sendJSON('/api/ticket', 'DELETE', { id: ticket.id })
      toast.success('Tipe tiket dihapus')
      router.push('/dankelola/ticket/tahap')
    } catch (e) { toast.error(String(e)) }
  }

  async function reloadBundles() {
    const b = await getJSON<TicketBundleDiscount[]>('/api/ticket/bundle')
    setBundles(b as TicketBundleDiscount[])
  }

  async function tambahBundle() {
    if (!ticket) return
    if (bundleMin < 2) { toast.error('Jumlah minimum minimal 2'); return }
    if (bundleDiskon <= 0 || bundleDiskon > 100) { toast.error('Diskon harus 1-100%'); return }
    setBundleSubmitting(true)
    try {
      await sendJSON('/api/ticket/bundle', 'POST', {
        tiket_tipe_id: ticket.id,
        jumlah_min: Number(bundleMin),
        diskon_persen: Number(bundleDiskon),
      })
      toast.success('Diskon bundle ditambahkan')
      await reloadBundles()
      setBundleMin(2)
      setBundleDiskon(0)
    } catch (e) { toast.error(String(e)) } finally { setBundleSubmitting(false) }
  }

  async function hapusBundle(id: string) {
    if (!window.confirm('Hapus diskon bundle ini?')) return
    try {
      await sendJSON('/api/ticket/bundle', 'DELETE', { id })
      toast.success('Diskon bundle dihapus')
      await reloadBundles()
    } catch (e) { toast.error(String(e)) }
  }
  const input = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10 disabled:bg-slate-50 disabled:text-slate-700'
  const label = 'mb-1 block text-xs font-medium text-slate-500'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600" />
      </div>
    )
  }
  if (!ticket) return null

  const tipePeriods = periods.filter((p) => p.tiket_tipe_id === ticket.id)
  const tipeBundles = bundles.filter((b) => b.tiket_tipe_id === ticket.id)

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {readOnly ? 'Detail Tipe Tiket' : 'Edit Tipe Tiket'}
        </h1>
        <p className="text-sm text-slate-500">{ticket.nama}</p>
      </div>

      {/* ── Form ── */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Informasi Dasar</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div><label className={label}>Nama Tiket</label><input disabled={readOnly} className={input} value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} /></div>
          <div><label className={label}>Harga Dasar (Rp)</label><input disabled={readOnly} type="number" min={0} className={input} value={form.harga || ''} onChange={e => setForm({ ...form, harga: Number(e.target.value) })} /></div>
          <div><label className={label}>Berlaku untuk (orang)</label><input disabled={readOnly} type="number" min={1} className={input} value={form.jumlah_orang} onChange={e => setForm({ ...form, jumlah_orang: Number(e.target.value) })} /></div>
        </div>
        <div><label className={label}>Deskripsi</label><textarea disabled={readOnly} className={input} rows={2} value={form.deskripsi} onChange={e => setForm({ ...form, deskripsi: e.target.value })} /></div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input disabled={readOnly} type="checkbox" checked={form.aktif} onChange={e => setForm({ ...form, aktif: e.target.checked })} /> <span>Buka order</span></label>
          <label className="flex items-center gap-2 text-sm"><input disabled={readOnly} type="checkbox" checked={form.is_hari_h} onChange={e => setForm({ ...form, is_hari_h: e.target.checked, kuota: e.target.checked ? form.kuota || 10 : 0 })} /> <span>Tiket Hari H (kuota terbatas)</span></label>
        </div>
        {form.is_hari_h && (
          <div className="grid gap-3 md:grid-cols-2">
            <div><label className={label}>Kuota</label><input disabled={readOnly} type="number" min={1} className={input} value={form.kuota} onChange={e => setForm({ ...form, kuota: Number(e.target.value) })} /></div>
            <div><label className={label}>Tutup Penjualan</label><input disabled={readOnly} type="datetime-local" className={input} value={form.selesai_jual} onChange={e => setForm({ ...form, selesai_jual: e.target.value })} /></div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          {readOnly ? (
            <Link href={`/dankelola/ticket/tipe/${ticket.id}/edit`} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-xl">Edit</Link>
          ) : (
            <>
              <button onClick={hapus} className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl">Hapus</button>
              <Link href="/dankelola/ticket/tahap" className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Batal</Link>
              <button onClick={simpan} disabled={submitting} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-xl disabled:opacity-50">{submitting ? 'Menyimpan...' : 'Simpan Perubahan'}</button>
            </>
          )}
        </div>
      </div>

      {/* ── Periode ── */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Periode Harga</h2>
          {!readOnly && <Link href={`/dankelola/ticket/periode`} className="text-xs text-primary-600 hover:underline">Kelola semua periode</Link>}
        </div>
        {tipePeriods.length === 0 ? (
          <p className="text-sm text-slate-400">Belum ada periode. Menggunakan harga dasar {formatRupiah(Number(ticket.harga))}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-2">Nama</th>
                  <th className="px-3 py-2">Periode</th>
                  <th className="px-3 py-2">Harga</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {tipePeriods.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{p.nama || '-'}</td>
                    <td className="px-3 py-2 text-slate-500">{p.tanggal_mulai} — {p.tanggal_selesai}</td>
                    <td className="px-3 py-2 font-semibold text-primary-600">{formatRupiah(Number(p.harga))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Bundle Discount ── */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-3">
        <h2 className="font-semibold text-slate-900">Diskon Bundle</h2>
        {tipeBundles.length === 0 ? (
          <p className="text-sm text-slate-400">Belum ada diskon bundle.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-2">Syarat</th>
                  <th className="px-3 py-2">Diskon</th>
                  {!readOnly && <th className="px-3 py-2">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {tipeBundles.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">Beli {b.jumlah_min}+ tiket</td>
                    <td className="px-3 py-2 font-semibold text-green-600">{b.diskon_persen}%</td>
                    {!readOnly && (
                      <td className="px-3 py-2">
                        <button onClick={() => hapusBundle(b.id)} className="text-xs text-red-600 hover:underline">Hapus</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!readOnly && (
          <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
            <div>
              <label className={label}>Beli minimal (tiket)</label>
              <input type="number" min={2} className={input} value={bundleMin} onChange={e => setBundleMin(Number(e.target.value))} />
            </div>
            <div>
              <label className={label}>Diskon (%)</label>
              <input type="number" min={1} max={100} className={input} value={bundleDiskon || ''} onChange={e => setBundleDiskon(Number(e.target.value))} />
            </div>
            <button onClick={tambahBundle} disabled={bundleSubmitting} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {bundleSubmitting ? 'Menyimpan...' : '+ Tambah Diskon'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
