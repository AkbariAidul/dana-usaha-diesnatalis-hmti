'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ChevronLeft, Pencil, Trash2 } from 'lucide-react'
import { getJSON, sendJSON } from '../../../../api'
import { PageSkeleton } from '../../../ui'
import type { KategoriSewa, KategoriBundleDiscount, HargaDasar, PeriodeHarga } from '@/lib/types'
import { periodeDariTanggal } from '@/lib/types'
import { formatRupiah, formatDate, todayISO } from '@/lib/utils'
import { useConfirm } from '@/components/confirm-dialog'

type Master = { kategori: KategoriSewa[]; hargaDasar: HargaDasar[]; periode: PeriodeHarga[] }

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10 disabled:bg-slate-50 disabled:text-slate-500'
const label = 'mb-1 block text-xs font-medium text-slate-500'

const emptyPeriode = { id: '', nama: '', tanggal_mulai: '', tanggal_selesai: '', harga: '' }
const emptyBundle = { id: '', jumlah_min: '', diskon_nominal: '', diskon_persen: '' }

export default function PaketHargaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const confirm = useConfirm()
  const isNew = id === 'new'

  const [paket, setPaket] = useState<KategoriSewa | null>(null)
  const [hargaDasar, setHargaDasar] = useState<HargaDasar[]>([])
  const [periods, setPeriods] = useState<PeriodeHarga[]>([])
  const [bundles, setBundles] = useState<KategoriBundleDiscount[]>([])
  const [form, setForm] = useState({ nama: '', keterangan: '', thumbnail_url: '', include_listrik: true, include_trashbag: true })
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [periodForm, setPeriodForm] = useState(emptyPeriode)
  const [bundleForm, setBundleForm] = useState(emptyBundle)
  const [loading, setLoading] = useState(!isNew)
  const [savingInfo, setSavingInfo] = useState(false)
  const [savingPeriode, setSavingPeriode] = useState(false)
  const [savingBundle, setSavingBundle] = useState(false)

  useEffect(() => {
    if (isNew) return
    if (!id) return
    ;(async () => {
      const [m, allBundles] = await Promise.all([
        getJSON<Master>('/api/master'),
        getJSON<KategoriBundleDiscount[]>('/api/tenant/bundle').catch(() => []),
      ])
      const found = (m.kategori || []).find((k) => k.id === id)
      if (!found) { toast.error('Paket tidak ditemukan'); return }
      setPaket(found)
      setForm({
        nama: found.nama,
        keterangan: found.keterangan ?? '',
        thumbnail_url: found.thumbnail_url ?? '',
        include_listrik: found.include_listrik,
        include_trashbag: found.include_trashbag,
      })
      setHargaDasar(m.hargaDasar || [])
      setPeriods(m.periode || [])
      setBundles(allBundles)
    })()
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  useEffect(() => {
    if (!thumbnailFile) {
      setThumbnailPreview(form.thumbnail_url || null)
      return
    }
    const url = URL.createObjectURL(thumbnailFile)
    setThumbnailPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [thumbnailFile, form.thumbnail_url])

  const activeKode = periodeDariTanggal(todayISO(), periods)

  const hargaByKode = useMemo(() => {
    const map = new Map<string, HargaDasar>()
    for (const h of hargaDasar) {
      if (h.kategori_sewa_id !== paket?.id) continue
      if (!map.has(h.periode) || h.jenis_usaha === 'F&B') map.set(h.periode, h)
    }
    return map
  }, [hargaDasar, paket?.id])

  const paketBundles = paket ? bundles.filter((b) => b.kategori_sewa_id === paket.id) : []

  async function reloadHarga() {
    const m = await getJSON<Master>('/api/master')
    setHargaDasar(m.hargaDasar || [])
    setPeriods(m.periode || [])
  }

  async function reloadBundles() {
    const b = await getJSON<KategoriBundleDiscount[]>('/api/tenant/bundle').catch(() => [])
    setBundles(b)
  }

  async function simpanInfo() {
    if (!form.nama.trim()) { toast.error('Nama paket wajib diisi'); return }
    setSavingInfo(true)
    try {
      let thumbnailUrl = form.thumbnail_url.trim() || null
      if (thumbnailFile) {
        const fd = new FormData()
        fd.append('file', thumbnailFile)
        fd.append('folder', 'tenant-thumbnail')
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal upload thumbnail')
        thumbnailUrl = data.url || null
      }

      const saved = await sendJSON('/api/master/kategori', 'POST', {
        ...(paket ? { id: paket.id } : {}),
        nama: form.nama.trim(),
        keterangan: form.keterangan.trim(),
        thumbnail_url: thumbnailUrl,
        include_listrik: form.include_listrik,
        include_trashbag: form.include_trashbag,
      }) as KategoriSewa

      setPaket(saved)
      setForm({
        nama: saved.nama,
        keterangan: saved.keterangan ?? '',
        thumbnail_url: saved.thumbnail_url ?? '',
        include_listrik: saved.include_listrik,
        include_trashbag: saved.include_trashbag,
      })
      setThumbnailFile(null)
      if (!paket) {
        await Promise.all([reloadHarga(), reloadBundles()])
        toast.success('Paket dibuat. Tambahkan periode harga & diskon bundle di bawah.')
        return
      }
      toast.success('Paket diperbarui')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingInfo(false)
    }
  }

  function resetPeriodeForm() {
    setPeriodForm(emptyPeriode)
  }

  function editPeriode(p: PeriodeHarga) {
    const existing = hargaByKode.get(p.kode)
    setPeriodForm({
      id: p.id,
      nama: p.nama,
      tanggal_mulai: p.tanggal_mulai,
      tanggal_selesai: p.tanggal_selesai,
      harga: existing ? String(existing.harga) : '',
    })
  }

  async function simpanPeriode() {
    if (!paket) return
    if (!periodForm.nama.trim()) { toast.error('Nama periode wajib diisi'); return }
    if (!periodForm.tanggal_mulai || !periodForm.tanggal_selesai) { toast.error('Tanggal wajib diisi'); return }
    if (periodForm.tanggal_selesai < periodForm.tanggal_mulai) { toast.error('Tanggal selesai harus setelah mulai'); return }
    const harga = Number(periodForm.harga)
    if (!periodForm.harga.trim() || !Number.isFinite(harga) || harga < 0) { toast.error('Harga wajib diisi'); return }
    setSavingPeriode(true)
    try {
      const saved = await sendJSON('/api/master/periode', 'POST', {
        ...(periodForm.id ? { id: periodForm.id } : {}),
        nama: periodForm.nama.trim(),
        tanggal_mulai: periodForm.tanggal_mulai,
        tanggal_selesai: periodForm.tanggal_selesai,
      }) as PeriodeHarga
      for (const jenis of ['F&B', 'Non-F&B'] as const) {
        const existing = hargaDasar.find((h) => h.kategori_sewa_id === paket.id && h.periode === saved.kode && h.jenis_usaha === jenis)
        if (existing && Number(existing.harga) === harga) continue
        await sendJSON('/api/master/harga', 'POST', {
          id: existing?.id,
          kategori_sewa_id: paket.id,
          jenis_usaha: jenis,
          periode: saved.kode,
          harga,
        })
      }
      await reloadHarga()
      resetPeriodeForm()
      toast.success(periodForm.id ? 'Periode diperbarui' : 'Periode harga ditambahkan')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingPeriode(false)
    }
  }

  async function hapusPeriode(p: PeriodeHarga) {
    const ok = await confirm({
      title: 'Hapus periode harga?',
      description: `Periode ${p.nama} dan harga semua paket pada periode ini ikut terhapus.`,
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      await sendJSON('/api/master/periode', 'DELETE', { id: p.id })
      if (periodForm.id === p.id) resetPeriodeForm()
      await reloadHarga()
      toast.success('Periode dihapus')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  function resetBundleForm() {
    setBundleForm(emptyBundle)
  }

  function editBundle(b: KategoriBundleDiscount) {
    setBundleForm({
      id: b.id,
      jumlah_min: String(b.jumlah_min),
      diskon_nominal: String(b.diskon_nominal),
      diskon_persen: String(b.diskon_persen),
    })
  }

  async function simpanBundle() {
    if (!paket) return
    const jumlahMin = Number(bundleForm.jumlah_min)
    const nominal = Number(bundleForm.diskon_nominal)
    const persen = Number(bundleForm.diskon_persen)
    if (!jumlahMin || jumlahMin < 2) { toast.error('Jumlah tenant minimal 2'); return }
    if (!Number.isFinite(nominal) || nominal < 0) { toast.error('Diskon nominal tidak valid'); return }
    if (!Number.isFinite(persen) || persen < 0 || persen > 100) { toast.error('Diskon persen harus 0-100'); return }
    if (!nominal && !persen) { toast.error('Isi diskon nominal atau persen'); return }
    setSavingBundle(true)
    try {
      await sendJSON('/api/tenant/bundle', 'POST', {
        ...(bundleForm.id ? { id: bundleForm.id } : {}),
        kategori_sewa_id: paket.id,
        jumlah_min: jumlahMin,
        diskon_nominal: nominal,
        diskon_persen: persen,
      })
      await reloadBundles()
      resetBundleForm()
      toast.success(bundleForm.id ? 'Diskon bundle diperbarui' : 'Diskon bundle ditambahkan')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingBundle(false)
    }
  }

  async function hapusBundle(b: KategoriBundleDiscount) {
    const ok = await confirm({
      title: 'Hapus diskon bundle?',
      description: `Diskon bundle minimal ${b.jumlah_min} tenant akan dihapus permanen.`,
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      await sendJSON('/api/tenant/bundle', 'DELETE', { id: b.id })
      if (bundleForm.id === b.id) resetBundleForm()
      await reloadBundles()
      toast.success('Diskon bundle dihapus')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (loading) return <PageSkeleton />
  if (!paket && !isNew) {
    return (
      <div className="space-y-3">
        <p className="text-red-600">Paket tidak ditemukan.</p>
        <Link href="/dankelola/tenants/harga" className="text-sm text-primary-600 hover:underline">← Kembali</Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dankelola/tenants/harga" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline">
          <ChevronLeft className="h-4 w-4" /> Kembali
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{paket ? paket.nama : 'Tambah Paket'}</h1>
          <p className="text-sm text-slate-500">
            {paket ? 'Atur informasi paket, periode harga, dan diskon bundle.' : 'Buat paket tenant baru, lalu atur periode harga dan diskon bundle.'}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Informasi Paket</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="h-24 w-[76px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {thumbnailPreview ? (
              <img src={thumbnailPreview} alt="Thumbnail paket" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-[10px] text-slate-400">4:5</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <label className={label}>Thumbnail</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
            />
            <p className="mt-1 text-xs text-slate-400">JPG/PNG/WebP maks. 5MB. Tampil di halaman Open Tenant.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={label}>Kode</label>
            <input disabled className={input} value={paket?.kode ?? 'Otomatis'} />
          </div>
          <div>
            <label className={label}>Nama Paket</label>
            <input className={input} value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
          </div>
        </div>
        <div>
          <label className={label}>Keterangan</label>
          <textarea rows={2} className={input} value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.include_listrik} onChange={(e) => setForm({ ...form, include_listrik: e.target.checked })} />
            <span>Termasuk listrik</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.include_trashbag} onChange={(e) => setForm({ ...form, include_trashbag: e.target.checked })} />
            <span>Termasuk trashbag</span>
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Link href="/dankelola/tenants/harga" className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            {paket ? 'Selesai' : 'Batal'}
          </Link>
          <button disabled={savingInfo} onClick={simpanInfo} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {savingInfo ? 'Menyimpan...' : paket ? 'Simpan Perubahan' : 'Simpan'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-3">
        <div>
          <h2 className="font-semibold text-slate-900">Periode Harga</h2>
          <p className="text-sm text-slate-500">Satu harga total per periode. Berlaku untuk F&B dan Non-F&B.</p>
        </div>
        {!paket ? (
          <p className="text-sm text-slate-400">Simpan informasi dasar terlebih dahulu untuk menambahkan periode harga.</p>
        ) : (
          <>
            {periods.length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada periode harga.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Nama</th>
                      <th className="px-3 py-2">Periode</th>
                      <th className="px-3 py-2">Harga</th>
                      <th className="px-3 py-2">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {periods.map((p) => {
                      const existing = hargaByKode.get(p.kode)
                      return (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium">
                            {p.nama || '-'}
                            {p.kode === activeKode && <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">Berjalan</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{formatDate(p.tanggal_mulai)} – {formatDate(p.tanggal_selesai)}</td>
                          <td className="px-3 py-2 font-semibold text-primary-600">
                            {existing ? formatRupiah(existing.harga) : <span className="text-slate-400">Belum diatur</span>}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button onClick={() => editPeriode(p)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary-600" title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => hapusPeriode(p)} className="grid h-7 w-7 place-items-center rounded-lg text-red-500 transition-colors hover:bg-red-50 hover:text-red-600" title="Hapus">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-5 md:items-end">
              <div><label className={label}>Nama</label><input className={input} value={periodForm.nama} onChange={(e) => setPeriodForm({ ...periodForm, nama: e.target.value })} placeholder="Early Bird" /></div>
              <div><label className={label}>Mulai</label><input type="date" className={input} value={periodForm.tanggal_mulai} onChange={(e) => setPeriodForm({ ...periodForm, tanggal_mulai: e.target.value })} /></div>
              <div><label className={label}>Selesai</label><input type="date" className={input} value={periodForm.tanggal_selesai} onChange={(e) => setPeriodForm({ ...periodForm, tanggal_selesai: e.target.value })} /></div>
              <div><label className={label}>Harga (Rp)</label><input type="number" min={0} className={input} placeholder="cth: 500000" value={periodForm.harga} onChange={(e) => setPeriodForm({ ...periodForm, harga: e.target.value })} /></div>
              <div className="flex gap-2">
                <button onClick={simpanPeriode} disabled={savingPeriode} className="flex-1 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {savingPeriode ? 'Menyimpan...' : periodForm.id ? 'Simpan' : '+ Tambah Periode'}
                </button>
                {periodForm.id && <button onClick={resetPeriodeForm} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">Batal</button>}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-3">
        <div>
          <h2 className="font-semibold text-slate-900">Diskon Bundle</h2>
          <p className="text-sm text-slate-500">Potongan saat menyewa beberapa tenant sekaligus.</p>
        </div>
        {!paket ? (
          <p className="text-sm text-slate-400">Simpan informasi dasar terlebih dahulu untuk menambahkan diskon bundle.</p>
        ) : (
          <>
            {paketBundles.length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada diskon bundle.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Syarat</th>
                      <th className="px-3 py-2">Diskon</th>
                      <th className="px-3 py-2">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {paketBundles.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium">Sewa minimal {b.jumlah_min} tenant</td>
                        <td className="px-3 py-2 font-semibold text-green-600">
                          {Number(b.diskon_nominal) > 0 && formatRupiah(Number(b.diskon_nominal))}
                          {Number(b.diskon_nominal) > 0 && Number(b.diskon_persen) > 0 && ' + '}
                          {Number(b.diskon_persen) > 0 && `${Number(b.diskon_persen)}%`}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => editBundle(b)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary-600" title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => hapusBundle(b)} className="grid h-7 w-7 place-items-center rounded-lg text-red-500 transition-colors hover:bg-red-50 hover:text-red-600" title="Hapus">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-4 md:items-end">
              <div><label className={label}>Minimal Tenant</label><input type="number" min={2} className={input} placeholder="cth: 3" value={bundleForm.jumlah_min} onChange={(e) => setBundleForm({ ...bundleForm, jumlah_min: e.target.value })} /></div>
              <div><label className={label}>Diskon Nominal (Rp)</label><input type="number" min={0} className={input} placeholder="cth: 50000" value={bundleForm.diskon_nominal} onChange={(e) => setBundleForm({ ...bundleForm, diskon_nominal: e.target.value })} /></div>
              <div><label className={label}>Diskon Persen (%)</label><input type="number" min={0} max={100} className={input} placeholder="cth: 10" value={bundleForm.diskon_persen} onChange={(e) => setBundleForm({ ...bundleForm, diskon_persen: e.target.value })} /></div>
              <div className="flex gap-2">
                <button onClick={simpanBundle} disabled={savingBundle} className="flex-1 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {savingBundle ? 'Menyimpan...' : bundleForm.id ? 'Simpan' : '+ Tambah Diskon'}
                </button>
                {bundleForm.id && <button onClick={resetBundleForm} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">Batal</button>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
