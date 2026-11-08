'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react'
import { getJSON, sendJSON } from '../../../../api'
import { PageSkeleton } from '../../../ui'
import type { KategoriSewa, KategoriPilihan, KategoriBundleDiscount, HargaDasar, PeriodeHarga } from '@/lib/types'
import { periodeDariTanggal } from '@/lib/types'
import { formatRupiah, formatDate, todayISO } from '@/lib/utils'
import { useConfirm } from '@/components/confirm-dialog'
import { useIsViewer } from '@/lib/dashboard-user'

type Master = { kategori: KategoriSewa[]; hargaDasar: HargaDasar[]; periode: PeriodeHarga[] }

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10 disabled:bg-slate-50 disabled:text-slate-500'
const label = 'mb-1 block text-xs font-medium text-slate-500'

const emptyPeriode = { id: '', nama: '', tanggal_mulai: '', tanggal_selesai: '', harga_fnb: '' }
const emptyPilihan = { id: '', nama: '', harga: '', gambar_url: '' }
const emptyBundle = { id: '', jumlah_min: '', diskon_nominal: '', diskon_persen: '' }

export default function PaketDetail({
  id: idProp,
  readOnly = false,
  create = false,
}: {
  id?: string
  readOnly?: boolean
  create?: boolean
}) {
  const routeId = useParams<{ id: string }>().id
  const id = idProp ?? routeId
  const confirm = useConfirm()
  const isNew = create || id === 'new'
  const isViewer = useIsViewer()
  const router = useRouter()

  useEffect(() => {
    if (!isViewer || readOnly) return
    router.replace(isNew ? '/dankelola/tenants/harga' : `/dankelola/tenants/harga/${id}`)
  }, [id, isNew, isViewer, readOnly, router])

  const [paket, setPaket] = useState<KategoriSewa | null>(null)
  const [hargaDasar, setHargaDasar] = useState<HargaDasar[]>([])
  const [periods, setPeriods] = useState<PeriodeHarga[]>([])
  const [pilihanList, setPilihanList] = useState<KategoriPilihan[]>([])
  const [bundles, setBundles] = useState<KategoriBundleDiscount[]>([])
  const [form, setForm] = useState({ nama: '', keterangan: '', thumbnail_url: '', include_listrik: true, include_trashbag: true, slot_tenant: '', selisih_nonfnb: '' })
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [periodForm, setPeriodForm] = useState(emptyPeriode)
  const [pilihanForm, setPilihanForm] = useState(emptyPilihan)
  const [bundleForm, setBundleForm] = useState(emptyBundle)
  const [loading, setLoading] = useState(!isNew)
  const [savingInfo, setSavingInfo] = useState(false)
  const [savingPeriode, setSavingPeriode] = useState(false)
  const [savingPilihan, setSavingPilihan] = useState(false)
  const [pilihanGambarFile, setPilihanGambarFile] = useState<File | null>(null)
  const [pilihanGambarPreview, setPilihanGambarPreview] = useState<string | null>(null)
  const [savingBundle, setSavingBundle] = useState(false)
  const reorderTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingReorder = useRef<{ kategori_sewa_id: string; ids: string[] } | null>(null)

  useEffect(() => () => {
    if (reorderTimer.current) clearTimeout(reorderTimer.current)
    if (pendingReorder.current) {
      void sendJSON('/api/tenant/pilihan', 'PATCH', pendingReorder.current).catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (isNew) return
    if (!id) return
    ;(async () => {
      const [m, allPilihan, allBundles] = await Promise.all([
        getJSON<Master>('/api/master'),
        getJSON<KategoriPilihan[]>('/api/tenant/pilihan').catch(() => []),
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
        slot_tenant: String(found.slot_tenant ?? 0),
        selisih_nonfnb: String(found.selisih_nonfnb ?? 0),
      })
      setHargaDasar(m.hargaDasar || [])
      setPeriods(m.periode || [])
      setPilihanList(allPilihan)
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

  const hargaByKey = useMemo(() => {
    const map = new Map<string, HargaDasar>()
    for (const h of hargaDasar) {
      if (h.kategori_sewa_id !== paket?.id) continue
      map.set(`${h.periode}|${h.jenis_usaha}`, h)
    }
    return map
  }, [hargaDasar, paket?.id])

  const paketPilihan = paket ? pilihanList.filter((p) => p.kategori_sewa_id === paket.id) : []
  const paketBundles = paket ? bundles.filter((b) => b.kategori_sewa_id === paket.id) : []

  async function reloadHarga() {
    const m = await getJSON<Master>('/api/master')
    setHargaDasar(m.hargaDasar || [])
    setPeriods(m.periode || [])
  }

  async function reloadPilihan() {
    const p = await getJSON<KategoriPilihan[]>('/api/tenant/pilihan').catch(() => [])
    setPilihanList(p)
  }

  async function reloadBundles() {
    const b = await getJSON<KategoriBundleDiscount[]>('/api/tenant/bundle').catch(() => [])
    setBundles(b)
  }

  async function syncHargaNonFnb(kategoriId: string, selisih: number) {
    const fnbRows = hargaDasar.filter((h) => h.kategori_sewa_id === kategoriId && h.jenis_usaha === 'F&B')
    for (const fnb of fnbRows) {
      const harga = Math.max(0, Number(fnb.harga) - selisih)
      const existing = hargaDasar.find(
        (h) => h.kategori_sewa_id === kategoriId && h.periode === fnb.periode && h.jenis_usaha === 'Non-F&B'
      )
      if (existing && Number(existing.harga) === harga) continue
      await sendJSON('/api/master/harga', 'POST', {
        id: existing?.id,
        kategori_sewa_id: kategoriId,
        jenis_usaha: 'Non-F&B',
        periode: fnb.periode,
        harga,
      })
    }
    await reloadHarga()
  }

  async function simpanInfo() {
    if (readOnly) return
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
        slot_tenant: Math.max(0, Number(form.slot_tenant) || 0),
        selisih_nonfnb: Math.max(0, Number(form.selisih_nonfnb) || 0),
      }) as KategoriSewa

      setPaket(saved)
      setForm({
        nama: saved.nama,
        keterangan: saved.keterangan ?? '',
        thumbnail_url: saved.thumbnail_url ?? '',
        include_listrik: saved.include_listrik,
        include_trashbag: saved.include_trashbag,
        slot_tenant: String(saved.slot_tenant ?? 0),
        selisih_nonfnb: String(saved.selisih_nonfnb ?? 0),
      })
      setThumbnailFile(null)
      if (!paket) {
        await Promise.all([reloadHarga(), reloadPilihan(), reloadBundles()])
        toast.success('Paket dibuat. Tambahkan periode, pilihan, & diskon bundle di bawah.')
        return
      }
      await syncHargaNonFnb(saved.id, Math.max(0, Number(saved.selisih_nonfnb) || 0))
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
    const fnb = hargaByKey.get(`${p.kode}|F&B`)
    setPeriodForm({
      id: p.id,
      nama: p.nama,
      tanggal_mulai: p.tanggal_mulai,
      tanggal_selesai: p.tanggal_selesai,
      harga_fnb: fnb ? String(fnb.harga) : '',
    })
  }

  async function simpanPeriode() {
    if (!paket || readOnly) return
    if (!periodForm.nama.trim()) { toast.error('Nama periode wajib diisi'); return }
    if (!periodForm.tanggal_mulai || !periodForm.tanggal_selesai) { toast.error('Tanggal wajib diisi'); return }
    if (periodForm.tanggal_selesai < periodForm.tanggal_mulai) { toast.error('Tanggal selesai harus setelah mulai'); return }
    const hargaFnb = Number(periodForm.harga_fnb)
    if (!periodForm.harga_fnb.trim() || !Number.isFinite(hargaFnb) || hargaFnb < 0) { toast.error('Harga F&B wajib diisi'); return }
    const hargaNonFnb = Math.max(0, hargaFnb - (Number(paket.selisih_nonfnb) || 0))
    setSavingPeriode(true)
    try {
      const saved = await sendJSON('/api/master/periode', 'POST', {
        ...(periodForm.id ? { id: periodForm.id } : {}),
        nama: periodForm.nama.trim(),
        tanggal_mulai: periodForm.tanggal_mulai,
        tanggal_selesai: periodForm.tanggal_selesai,
      }) as PeriodeHarga
      const hargaPerJenis = { 'F&B': hargaFnb, 'Non-F&B': hargaNonFnb } as const
      for (const jenis of ['F&B', 'Non-F&B'] as const) {
        const existing = hargaDasar.find((h) => h.kategori_sewa_id === paket.id && h.periode === saved.kode && h.jenis_usaha === jenis)
        if (existing && Number(existing.harga) === hargaPerJenis[jenis]) continue
        await sendJSON('/api/master/harga', 'POST', {
          id: existing?.id,
          kategori_sewa_id: paket.id,
          jenis_usaha: jenis,
          periode: saved.kode,
          harga: hargaPerJenis[jenis],
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

  function resetPilihanForm() {
    setPilihanForm(emptyPilihan)
    setPilihanGambarFile(null)
    setPilihanGambarPreview(null)
  }

  function editPilihan(p: KategoriPilihan) {
    setPilihanForm({ id: p.id, nama: p.nama, harga: String(p.harga), gambar_url: p.gambar_url ?? '' })
    setPilihanGambarFile(null)
    setPilihanGambarPreview(p.gambar_url ?? null)
  }

  async function simpanPilihan() {
    if (!paket || readOnly) return
    const nama = pilihanForm.nama.trim()
    const harga = Number(pilihanForm.harga)
    if (!nama) { toast.error('Nama pilihan wajib diisi'); return }
    if (!Number.isFinite(harga) || harga < 0) { toast.error('Harga tidak valid'); return }
    let gambarUrl = pilihanForm.gambar_url?.trim() || null
    if (pilihanGambarFile) {
      const fd = new FormData()
      fd.append('file', pilihanGambarFile)
      fd.append('folder', 'tenant-pilihan-gambar')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal upload gambar')
      gambarUrl = data.url || null
    }
    setSavingPilihan(true)
    try {
      await sendJSON('/api/tenant/pilihan', 'POST', {
        ...(pilihanForm.id ? { id: pilihanForm.id } : {}),
        kategori_sewa_id: paket.id,
        nama,
        harga,
        gambar_url: gambarUrl,
      })
      await reloadPilihan()
      resetPilihanForm()
      toast.success(pilihanForm.id ? 'Pilihan paket diperbarui' : 'Pilihan paket ditambahkan')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingPilihan(false)
    }
  }

  function movePilihan(p: KategoriPilihan, arah: -1 | 1) {
    if (!paket || readOnly) return
    const index = paketPilihan.findIndex((item) => item.id === p.id)
    const target = index + arah
    if (index < 0 || target < 0 || target >= paketPilihan.length) return
    const next = [...paketPilihan]
    ;[next[index], next[target]] = [next[target], next[index]]
    setPilihanList((prev) => [...prev.filter((item) => item.kategori_sewa_id !== paket.id), ...next])
    pendingReorder.current = { kategori_sewa_id: paket.id, ids: next.map((item) => item.id) }
    if (reorderTimer.current) clearTimeout(reorderTimer.current)
    reorderTimer.current = setTimeout(() => {
      const payload = pendingReorder.current
      pendingReorder.current = null
      if (!payload) return
      void sendJSON('/api/tenant/pilihan', 'PATCH', payload).catch((e) => {
        toast.error((e as Error).message)
        void reloadPilihan()
      })
    }, 200)
  }

  async function hapusPilihan(p: KategoriPilihan) {
    const ok = await confirm({
      title: 'Hapus pilihan paket?',
      description: `Pilihan "${p.nama}" akan dihapus permanen.`,
      confirmText: 'Hapus',
    })
    if (!ok) return
    const prev = pilihanList
    setPilihanList((list) => list.filter((item) => item.id !== p.id))
    if (pilihanForm.id === p.id) resetPilihanForm()
    try {
      await sendJSON('/api/tenant/pilihan', 'DELETE', { id: p.id })
      toast.success('Pilihan paket dihapus')
    } catch (e) {
      setPilihanList(prev)
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
    if (!paket || readOnly) return
    const jumlah = Number(bundleForm.jumlah_min)
    const nominal = Number(bundleForm.diskon_nominal)
    const persen = Number(bundleForm.diskon_persen)
    if (!jumlah || jumlah < 2) { toast.error('Jumlah tenant tidak valid'); return }
    if (!Number.isFinite(nominal) || nominal < 0) { toast.error('Diskon nominal tidak valid'); return }
    if (!Number.isFinite(persen) || persen < 0 || persen > 100) { toast.error('Diskon persen harus 0-100'); return }
    if (!nominal && !persen) { toast.error('Isi diskon nominal atau persen'); return }
    setSavingBundle(true)
    try {
      await sendJSON('/api/tenant/bundle', 'POST', {
        ...(bundleForm.id ? { id: bundleForm.id } : {}),
        kategori_sewa_id: paket.id,
        jumlah_min: jumlah,
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
      description: `Diskon bundle untuk ${b.jumlah_min} tenant akan dihapus permanen.`,
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

  if (isViewer && !readOnly) return <PageSkeleton />
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {create ? (paket ? 'Edit Paket' : 'Tambah Paket') : readOnly ? 'Detail Paket' : 'Edit Paket'}
        </h1>
        <p className="text-sm text-slate-500">
          {paket ? paket.nama : 'Buat paket tenant baru, lalu atur periode harga dan diskon bundle.'}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Informasi Paket</h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="w-[100px] shrink-0 space-y-2">
            <div className="h-32 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {thumbnailPreview ? (
                <img src={thumbnailPreview} alt="Thumbnail paket" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-[10px] text-slate-400">4:5</div>
              )}
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={readOnly}
              onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
              className="block w-full text-[10px] text-slate-500 file:mr-1 file:rounded file:border-0 file:bg-slate-100 file:px-1.5 file:py-1 file:text-[10px] file:font-medium file:text-slate-700 disabled:opacity-50"
            />
            <p className="text-[10px] leading-tight text-slate-400">JPG/PNG/WebP maks. 5MB.</p>
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <label className={label}>Nama Paket</label>
              <input disabled={readOnly} className={input} value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
            </div>
            <div>
              <label className={label}>Keterangan</label>
              <textarea disabled={readOnly} rows={4} className={input} value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input disabled={readOnly} type="checkbox" checked={form.include_listrik} onChange={(e) => setForm({ ...form, include_listrik: e.target.checked })} />
            <span>Termasuk listrik</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input disabled={readOnly} type="checkbox" checked={form.include_trashbag} onChange={(e) => setForm({ ...form, include_trashbag: e.target.checked })} />
            <span>Termasuk trashbag</span>
          </label>
          <div className="w-32">
            <label className={label}>Slot Tenant</label>
            <input disabled={readOnly} type="number" min={0} className={input} placeholder="0 = tanpa batas" value={form.slot_tenant} onChange={(e) => setForm({ ...form, slot_tenant: e.target.value })} />
          </div>
          <div className="w-44">
            <label className={label}>Non-F&B lebih murah (Rp)</label>
            <input disabled={readOnly} type="number" min={0} className={input} placeholder="cth: 50000 = 50 ribu" value={form.selisih_nonfnb} onChange={(e) => setForm({ ...form, selisih_nonfnb: e.target.value })} />
            <p className="mt-1 text-[10px] text-slate-400">Harga F&B dari periode. Non-F&B = harga periode − selisih.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {readOnly ? (
            isViewer ? (
              <Link href="/dankelola/tenants/harga" className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
                Kembali
              </Link>
            ) : (
              <Link href={`/dankelola/tenants/harga/${paket?.id ?? id}/edit`} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
                Edit
              </Link>
            )
          ) : (
            <>
              <Link href="/dankelola/tenants/harga" className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
                {paket ? 'Selesai' : 'Batal'}
              </Link>
              <button disabled={savingInfo} onClick={simpanInfo} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {savingInfo ? 'Menyimpan...' : paket ? 'Simpan Perubahan' : 'Simpan'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-3">
        <div>
          <h2 className="font-semibold text-slate-900">Pilihan Paket</h2>
          <p className="text-sm text-slate-500">Fasilitas tambahan per paket. Tampil sebagai checkbox di form pendaftaran tenant. Harga Tempat sudah memakai harga periode, jadi tidak perlu ditambahkan di sini.</p>
        </div>
        {!paket ? (
          <p className="text-sm text-slate-400">Simpan informasi dasar terlebih dahulu untuk menambahkan pilihan paket.</p>
        ) : (
          <>
            {paketPilihan.length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada pilihan paket.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Pilihan</th>
                      <th className="px-3 py-2">Harga</th>
                      {!readOnly && <th className="px-3 py-2">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {paketPilihan.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {p.gambar_url && (
                        <img src={p.gambar_url} alt={p.nama} className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 object-cover" />
                      )}
                      <span className="font-medium">{p.nama}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-semibold text-primary-600">{formatRupiah(Number(p.harga))}</td>
                        {!readOnly && (
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button onClick={() => movePilihan(p, -1)} disabled={paketPilihan[0]?.id === p.id} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary-600 disabled:opacity-30" title="Naikkan">
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => movePilihan(p, 1)} disabled={paketPilihan[paketPilihan.length - 1]?.id === p.id} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary-600 disabled:opacity-30" title="Turunkan">
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => editPilihan(p)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary-600" title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => hapusPilihan(p)} className="grid h-7 w-7 place-items-center rounded-lg text-red-500 transition-colors hover:bg-red-50 hover:text-red-600" title="Hapus">
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
              <div className="grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-[1fr_1fr_120px] md:items-end">
                <div><label className={label}>Nama Pilihan</label><input className={input} placeholder="cth: Meja + Kursi" value={pilihanForm.nama} onChange={(e) => setPilihanForm({ ...pilihanForm, nama: e.target.value })} /></div>
                <div><label className={label}>Harga (Rp)</label><input type="number" min={0} className={input} placeholder="cth: 100000" value={pilihanForm.harga} onChange={(e) => setPilihanForm({ ...pilihanForm, harga: e.target.value })} /></div>
                <div>
                  <label className={label}>Gambar Ilustrasi</label>
                  <div className="flex items-center gap-2">
                    {pilihanGambarPreview ? (
                      <img src={pilihanGambarPreview} alt="Preview" className="h-10 w-10 rounded-lg border border-slate-200 object-cover" />
                    ) : (
                      <div className="grid h-10 w-10 place-items-center rounded-lg border border-dashed border-slate-300 text-[9px] text-slate-400">+</div>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null
                        setPilihanGambarFile(f)
                        if (f) {
                          const url = URL.createObjectURL(f)
                          setPilihanGambarPreview(url)
                        } else {
                          setPilihanGambarPreview(null)
                        }
                      }}
                      className="block w-full text-xs text-slate-500 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">Opsional · JPG/PNG/WebP maks 5MB</p>
                </div>
                <div className="flex gap-2 md:col-span-3">
                  <button onClick={simpanPilihan} disabled={savingPilihan} className="flex-1 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                    {savingPilihan ? 'Menyimpan...' : pilihanForm.id ? 'Simpan' : '+ Tambah Pilihan'}
                  </button>
                  {pilihanForm.id && <button onClick={resetPilihanForm} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">Batal</button>}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-3">
        <div>
          <h2 className="font-semibold text-slate-900">Periode Harga</h2>
          <p className="text-sm text-slate-500">Harga F&B per periode. Non-F&B otomatis lebih murah sesuai selisih di atas.</p>
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
                      <th className="px-3 py-2">F&B</th>
                      <th className="px-3 py-2">Non-F&B</th>
                      {!readOnly && <th className="px-3 py-2">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {periods.map((p) => {
                      const fnb = hargaByKey.get(`${p.kode}|F&B`)
                      const nonfnb = hargaByKey.get(`${p.kode}|Non-F&B`)
                      return (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium">
                            {p.nama || '-'}
                            {p.kode === activeKode && <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">Berjalan</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{formatDate(p.tanggal_mulai)} – {formatDate(p.tanggal_selesai)}</td>
                          <td className="px-3 py-2 font-semibold text-primary-600">
                            {fnb ? formatRupiah(fnb.harga) : <span className="text-slate-400">Belum diatur</span>}
                          </td>
                          <td className="px-3 py-2 font-semibold text-primary-600">
                            {nonfnb ? formatRupiah(nonfnb.harga) : <span className="text-slate-400">Belum diatur</span>}
                          </td>
                          {!readOnly && (
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
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!readOnly && (
              <div className="grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-5 md:items-end">
                <div><label className={label}>Nama</label><input className={input} value={periodForm.nama} onChange={(e) => setPeriodForm({ ...periodForm, nama: e.target.value })} placeholder="Early Bird" /></div>
                <div><label className={label}>Mulai</label><input type="date" className={input} value={periodForm.tanggal_mulai} onChange={(e) => setPeriodForm({ ...periodForm, tanggal_mulai: e.target.value })} /></div>
                <div><label className={label}>Selesai</label><input type="date" className={input} value={periodForm.tanggal_selesai} onChange={(e) => setPeriodForm({ ...periodForm, tanggal_selesai: e.target.value })} /></div>
                <div>
                  <label className={label}>Harga</label>
                  <input type="number" min={0} className={input} placeholder="cth: 500000" value={periodForm.harga_fnb} onChange={(e) => setPeriodForm({ ...periodForm, harga_fnb: e.target.value })} />
                  <p className="mt-1 text-[10px] text-slate-400">F&B periode ini · Non-F&B: {formatRupiah(Math.max(0, (Number(periodForm.harga_fnb) || 0) - (Number(paket?.selisih_nonfnb) || 0)))}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={simpanPeriode} disabled={savingPeriode} className="flex-1 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                    {savingPeriode ? 'Menyimpan...' : periodForm.id ? 'Simpan' : '+ Tambah Periode'}
                  </button>
                  {periodForm.id && <button onClick={resetPeriodeForm} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">Batal</button>}
                </div>
              </div>
            )}
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
                      {!readOnly && <th className="px-3 py-2">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {paketBundles.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium">Sewa {b.jumlah_min} tenant</td>
                        <td className="px-3 py-2 font-semibold text-green-600">
                          {Number(b.diskon_nominal) > 0 && formatRupiah(Number(b.diskon_nominal))}
                          {Number(b.diskon_nominal) > 0 && Number(b.diskon_persen) > 0 && ' + '}
                          {Number(b.diskon_persen) > 0 && `${Number(b.diskon_persen)}%`}
                        </td>
                        {!readOnly && (
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
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!readOnly && (
              <div className="grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-4 md:items-end">
                <div><label className={label}>Jumlah Tenant</label><input type="number" min={2} className={input} placeholder="cth: 3" value={bundleForm.jumlah_min} onChange={(e) => setBundleForm({ ...bundleForm, jumlah_min: e.target.value })} /></div>
                <div><label className={label}>Diskon Nominal (Rp)</label><input type="number" min={0} className={input} placeholder="cth: 50000" value={bundleForm.diskon_nominal} onChange={(e) => setBundleForm({ ...bundleForm, diskon_nominal: e.target.value })} /></div>
                <div><label className={label}>Diskon Persen (%)</label><input type="number" min={0} max={100} className={input} placeholder="cth: 10" value={bundleForm.diskon_persen} onChange={(e) => setBundleForm({ ...bundleForm, diskon_persen: e.target.value })} /></div>
                <div className="flex gap-2">
                  <button onClick={simpanBundle} disabled={savingBundle} className="flex-1 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                    {savingBundle ? 'Menyimpan...' : bundleForm.id ? 'Simpan' : '+ Tambah Diskon'}
                  </button>
                  {bundleForm.id && <button onClick={resetBundleForm} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">Batal</button>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
