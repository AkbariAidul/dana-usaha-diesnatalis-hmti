'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../../api'
import type { TicketKatalogItem, TicketPeriode, TicketBundleDiscount } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import { Pencil, Trash2 } from 'lucide-react'
import { useConfirm } from '@/components/confirm-dialog'
import { useIsViewer } from '@/lib/dashboard-user'

type FormState = {
  nama: string
  deskripsi: string
  thumbnail_url: string
  harga: number
  jumlah_orang: number
  aktif: boolean
  is_hari_h: boolean
  kuota: number
  mulai_jual: string
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
  create = false,
}: {
  params?: Promise<{ id: string }>
  readOnly?: boolean
  create?: boolean
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const isViewer = useIsViewer()
  const [ticket, setTicket] = useState<TicketKatalogItem | null>(null)
  const [periods, setPeriods] = useState<TicketPeriode[]>([])
  const [bundles, setBundles] = useState<TicketBundleDiscount[]>([])
  const [form, setForm] = useState<FormState>({ nama: '', deskripsi: '', thumbnail_url: '', harga: 0, jumlah_orang: 1, aktif: true, is_hari_h: false, kuota: 10, mulai_jual: '', selesai_jual: '' })
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(!create)
  const [bundleMin, setBundleMin] = useState(2)
  const [bundleDiskon, setBundleDiskon] = useState(0)
  const [bundleSubmitting, setBundleSubmitting] = useState(false)
  const [periodeNama, setPeriodeNama] = useState('')
  const [periodeMulai, setPeriodeMulai] = useState('')
  const [periodeSelesai, setPeriodeSelesai] = useState('')
  const [periodeHarga, setPeriodeHarga] = useState(0)
  const [periodeSubmitting, setPeriodeSubmitting] = useState(false)
  const [editPeriodeId, setEditPeriodeId] = useState<string | null>(null)
  const [editBundleId, setEditBundleId] = useState<string | null>(null)

  useEffect(() => {
    if (create) return
    ;(async () => {
      if (!params) return
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
        thumbnail_url: found.thumbnail_url ?? '',
        harga: Number(found.harga),
        jumlah_orang: Number(found.jumlah_orang ?? 1),
        aktif: found.aktif,
        is_hari_h: Boolean(found.is_hari_h),
        kuota: Number(found.kuota ?? 0) || 10,
        mulai_jual: toLocalInput(found.mulai_jual),
        selesai_jual: toLocalInput(found.selesai_jual),
      })
      setLoading(false)
    })()
  }, [params, router, create])

  useEffect(() => {
    if (!thumbnailFile) {
      setThumbnailPreview(form.thumbnail_url || null)
      return
    }
    const url = URL.createObjectURL(thumbnailFile)
    setThumbnailPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [thumbnailFile, form.thumbnail_url])

  async function simpan() {
    if (!form.nama.trim() || !form.harga) { toast.error('Nama dan harga wajib diisi'); return }
    if (form.mulai_jual && form.selesai_jual && new Date(form.selesai_jual) <= new Date(form.mulai_jual)) {
      toast.error('Tutup penjualan harus setelah mulai jual')
      return
    }
    setSubmitting(true)
    try {
      let thumbnailUrl = form.thumbnail_url.trim() || null
      if (thumbnailFile) {
        const fd = new FormData()
        fd.append('file', thumbnailFile)
        fd.append('folder', 'ticket-thumbnail')
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal upload thumbnail')
        thumbnailUrl = data.url || null
      }

      const saved = await sendJSON('/api/ticket', 'POST', {
        ...(ticket ? { id: ticket.id } : {}),
        nama: form.nama.trim(),
        deskripsi: form.deskripsi.trim() || null,
        thumbnail_url: thumbnailUrl,
        harga: Number(form.harga),
        jumlah_orang: Number(form.jumlah_orang) || 1,
        aktif: form.aktif,
        is_hari_h: form.is_hari_h,
        kuota: form.is_hari_h ? Number(form.kuota) || 10 : 0,
        mulai_jual: form.mulai_jual ? new Date(form.mulai_jual).toISOString() : null,
        selesai_jual: form.selesai_jual ? new Date(form.selesai_jual).toISOString() : null,
      }) as TicketKatalogItem
      if (!ticket) {
        setTicket(saved)
        setForm((prev) => ({ ...prev, thumbnail_url: saved.thumbnail_url ?? '' }))
        setThumbnailFile(null)
        await Promise.all([reloadPeriods(), reloadBundles()])
        toast.success('Tipe tiket dibuat. Tambahkan periode harga & diskon bundle di bawah.')
        return
      }
      setForm((prev) => ({ ...prev, thumbnail_url: saved.thumbnail_url ?? '' }))
      setThumbnailFile(null)
      toast.success('Tipe tiket diperbarui')
      router.push('/dankelola/ticket/tahap')
    } catch (e) { toast.error(String(e)) } finally { setSubmitting(false) }
  }

  async function hapus() {
    if (!ticket) return
    const ok = await confirm({
      title: 'Hapus tipe tiket?',
      description: `Tipe "${ticket.nama}" dan semua data terkait akan dihapus permanen.`,
      confirmText: 'Hapus',
    })
    if (!ok) return
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

  async function simpanBundle() {
    if (!ticket) return
    if (bundleMin < 2) { toast.error('Jumlah tiket minimal 2'); return }
    if (bundleDiskon <= 0 || bundleDiskon > 100) { toast.error('Diskon harus 1-100%'); return }
    setBundleSubmitting(true)
    try {
      await sendJSON('/api/ticket/bundle', 'POST', {
        ...(editBundleId ? { id: editBundleId } : {}),
        tiket_tipe_id: ticket.id,
        jumlah_min: Number(bundleMin),
        diskon_persen: Number(bundleDiskon),
      })
      await reloadBundles()
      toast.success(editBundleId ? 'Diskon bundle diperbarui' : 'Diskon bundle ditambahkan')
      resetBundleForm()
    } catch (e) { toast.error(String(e)) } finally { setBundleSubmitting(false) }
  }

  function resetBundleForm() {
    setEditBundleId(null)
    setBundleMin(2)
    setBundleDiskon(0)
  }

  function editBundle(b: TicketBundleDiscount) {
    setEditBundleId(b.id)
    setBundleMin(b.jumlah_min)
    setBundleDiskon(b.diskon_persen)
  }

  async function hapusBundle(id: string) {
    const ok = await confirm({
      title: 'Hapus diskon bundle?',
      description: 'Diskon bundle ini akan dihapus permanen.',
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      await sendJSON('/api/ticket/bundle', 'DELETE', { id })
      await reloadBundles()
      toast.success('Diskon bundle dihapus')
    } catch (e) { toast.error(String(e)) }
  }

  async function reloadPeriods() {
    const p = await getJSON<TicketPeriode[]>('/api/ticket/periode')
    setPeriods(p as TicketPeriode[])
  }

  async function simpanPeriode() {
    if (!ticket) return
    if (!periodeMulai || !periodeSelesai) { toast.error('Tanggal wajib diisi'); return }
    if (periodeSelesai < periodeMulai) { toast.error('Tanggal selesai harus setelah mulai'); return }
    if (!periodeHarga) { toast.error('Harga wajib diisi'); return }
    setPeriodeSubmitting(true)
    try {
      await sendJSON('/api/ticket/periode', 'POST', {
        ...(editPeriodeId ? { id: editPeriodeId } : {}),
        tiket_tipe_id: ticket.id,
        nama: periodeNama.trim() || null,
        tanggal_mulai: periodeMulai,
        tanggal_selesai: periodeSelesai,
        harga: Number(periodeHarga),
      })
      await reloadPeriods()
      toast.success(editPeriodeId ? 'Periode diperbarui' : 'Periode harga ditambahkan')
      resetPeriodeForm()
    } catch (e) { toast.error(String(e)) } finally { setPeriodeSubmitting(false) }
  }

  function resetPeriodeForm() {
    setEditPeriodeId(null)
    setPeriodeNama('')
    setPeriodeMulai('')
    setPeriodeSelesai('')
    setPeriodeHarga(0)
  }

  function editPeriode(p: TicketPeriode) {
    setEditPeriodeId(p.id)
    setPeriodeNama(p.nama ?? '')
    setPeriodeMulai(p.tanggal_mulai.slice(0, 10))
    setPeriodeSelesai(p.tanggal_selesai.slice(0, 10))
    setPeriodeHarga(Number(p.harga))
  }

  async function hapusPeriode(id: string) {
    const ok = await confirm({
      title: 'Hapus periode harga?',
      description: 'Periode harga ini akan dihapus permanen.',
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      await sendJSON('/api/ticket/periode', 'DELETE', { id })
      await reloadPeriods()
      toast.success('Periode dihapus')
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
  if (!ticket && !create) return null

  const tipePeriods = ticket ? periods.filter((p) => p.tiket_tipe_id === ticket.id) : []
  const tipeBundles = ticket ? bundles.filter((b) => b.tiket_tipe_id === ticket.id) : []

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {create ? (ticket ? 'Edit Tipe Tiket' : 'Tambah Tipe Tiket') : readOnly ? 'Detail Tipe Tiket' : 'Edit Tipe Tiket'}
        </h1>
        <p className="text-sm text-slate-500">
          {ticket ? ticket.nama : 'Buat tipe tiket baru untuk dijual di halaman publik.'}
        </p>
      </div>

      {/* ── Form ── */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Informasi Dasar</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div><label className={label}>Nama Tiket</label><input disabled={readOnly} className={input} placeholder="cth: Tiket Presale" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} /></div>
          <div><label className={label}>Harga Dasar (Rp)</label><input disabled={readOnly} type="number" min={0} className={input} placeholder="cth: 50000" value={form.harga || ''} onChange={e => setForm({ ...form, harga: Number(e.target.value) })} /></div>
          <div><label className={label}>Berlaku untuk (orang)</label><input disabled={readOnly} type="number" min={1} className={input} placeholder="cth: 1" value={form.jumlah_orang || ''} onChange={e => setForm({ ...form, jumlah_orang: Number(e.target.value) })} /></div>
        </div>
        <div><label className={label}>Deskripsi</label><textarea disabled={readOnly} className={input} rows={2} placeholder="Deskripsi singkat tipe tiket" value={form.deskripsi} onChange={e => setForm({ ...form, deskripsi: e.target.value })} /></div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="h-24 w-[76px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {thumbnailPreview ? (
              <img src={thumbnailPreview} alt="Thumbnail tiket" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-[10px] text-slate-400">4:5</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <label className={label}>Thumbnail</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={readOnly}
              onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
            />
            <p className="mt-1 text-xs text-slate-400">JPG/PNG/WebP maks. 5MB. Tampil di halaman publik tiket.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input disabled={readOnly} type="checkbox" checked={form.aktif} onChange={e => setForm({ ...form, aktif: e.target.checked })} /> <span>Buka order</span></label>
          <label className="flex items-center gap-2 text-sm"><input disabled={readOnly} type="checkbox" checked={form.is_hari_h} onChange={e => setForm({ ...form, is_hari_h: e.target.checked, kuota: e.target.checked ? form.kuota || 10 : 0 })} /> <span>Tiket Hari H (kuota terbatas)</span></label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div><label className={label}>Mulai Jual</label><input disabled={readOnly} type="datetime-local" className={input} value={form.mulai_jual} onChange={e => setForm({ ...form, mulai_jual: e.target.value })} /></div>
          <div><label className={label}>Tutup Penjualan</label><input disabled={readOnly} type="datetime-local" className={input} value={form.selesai_jual} onChange={e => setForm({ ...form, selesai_jual: e.target.value })} /></div>
        </div>
        <p className="-mt-2 text-xs text-slate-400">Kosongkan bila tiket mengikuti periode harga atau tanpa batas tanggal.</p>
        {form.is_hari_h && (
          <div className="w-44"><label className={label}>Kuota</label><input disabled={readOnly} type="number" min={1} className={input} placeholder="cth: 10" value={form.kuota || ''} onChange={e => setForm({ ...form, kuota: Number(e.target.value) })} /></div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          {readOnly ? (
            isViewer ? (
              <Link href="/dankelola/ticket/tahap" className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Kembali</Link>
            ) : (
              <Link href={`/dankelola/ticket/tipe/${ticket?.id}/edit`} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-xl">Edit</Link>
            )
          ) : !ticket ? (
            <>
              <Link href="/dankelola/ticket/tahap" className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Batal</Link>
              <button onClick={simpan} disabled={submitting} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-xl disabled:opacity-50">{submitting ? 'Menyimpan...' : 'Simpan'}</button>
            </>
          ) : (
            <>
              {!create && <button onClick={hapus} className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl">Hapus</button>}
              <Link href="/dankelola/ticket/tahap" className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">{create ? 'Selesai' : 'Batal'}</Link>
              <button onClick={simpan} disabled={submitting} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-xl disabled:opacity-50">{submitting ? 'Menyimpan...' : 'Simpan Perubahan'}</button>
            </>
          )}
        </div>
      </div>

      {/* ── Periode ── */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-3">
        <h2 className="font-semibold text-slate-900">Periode Harga</h2>
        {create && !ticket ? (
          <p className="text-sm text-slate-400">Simpan informasi dasar terlebih dahulu untuk menambahkan periode harga.</p>
        ) : (
          <>
            {tipePeriods.length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada periode. Menggunakan harga dasar {formatRupiah(Number(ticket?.harga ?? 0))}.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left">
                    <tr>
                      <th className="px-3 py-2">Nama</th>
                      <th className="px-3 py-2">Periode</th>
                      <th className="px-3 py-2">Harga</th>
                      {!readOnly && <th className="px-3 py-2">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {tipePeriods.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium">{p.nama || '-'}</td>
                        <td className="px-3 py-2 text-slate-500">{p.tanggal_mulai.slice(0, 10)} — {p.tanggal_selesai.slice(0, 10)}</td>
                        <td className="px-3 py-2 font-semibold text-primary-600">{formatRupiah(Number(p.harga))}</td>
                        {!readOnly && (
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button onClick={() => editPeriode(p)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-primary-600 transition-colors" title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => hapusPeriode(p.id)} className="grid h-7 w-7 place-items-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors" title="Hapus">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!readOnly && (
              <div className="grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-5 md:items-end">
                <div><label className={label}>Nama (opsional)</label><input className={input} value={periodeNama} onChange={e => setPeriodeNama(e.target.value)} placeholder="Early Bird" /></div>
                <div><label className={label}>Mulai</label><input type="date" className={input} value={periodeMulai} onChange={e => setPeriodeMulai(e.target.value)} /></div>
                <div><label className={label}>Selesai</label><input type="date" className={input} value={periodeSelesai} onChange={e => setPeriodeSelesai(e.target.value)} /></div>
                <div><label className={label}>Harga (Rp)</label><input type="number" min={0} className={input} placeholder="cth: 50000" value={periodeHarga || ''} onChange={e => setPeriodeHarga(Number(e.target.value))} /></div>
                <div className="flex gap-2">
                  <button onClick={simpanPeriode} disabled={periodeSubmitting} className="flex-1 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                    {periodeSubmitting ? 'Menyimpan...' : editPeriodeId ? 'Simpan' : '+ Tambah Periode'}
                  </button>
                  {editPeriodeId && <button onClick={resetPeriodeForm} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">Batal</button>}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Bundle Discount ── */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-3">
        <h2 className="font-semibold text-slate-900">Diskon Bundle</h2>
        {create && !ticket ? (
          <p className="text-sm text-slate-400">Simpan informasi dasar terlebih dahulu untuk menambahkan diskon bundle.</p>
        ) : (
          <>
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
                        <td className="px-3 py-2">Beli {b.jumlah_min} tiket</td>
                        <td className="px-3 py-2 font-semibold text-green-600">{b.diskon_persen}%</td>
                        {!readOnly && (
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button onClick={() => editBundle(b)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-primary-600 transition-colors" title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => hapusBundle(b.id)} className="grid h-7 w-7 place-items-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors" title="Hapus">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
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
                  <label className={label}>Jumlah tiket</label>
                  <input type="number" min={2} className={input} placeholder="cth: 5" value={bundleMin || ''} onChange={e => setBundleMin(Number(e.target.value))} />
                </div>
                <div>
                  <label className={label}>Diskon (%)</label>
                  <input type="number" min={1} max={100} className={input} placeholder="cth: 10" value={bundleDiskon || ''} onChange={e => setBundleDiskon(Number(e.target.value))} />
                </div>
                <button onClick={simpanBundle} disabled={bundleSubmitting} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {bundleSubmitting ? 'Menyimpan...' : editBundleId ? 'Simpan' : '+ Tambah Diskon'}
                </button>
                {editBundleId && <button onClick={resetBundleForm} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">Batal</button>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
