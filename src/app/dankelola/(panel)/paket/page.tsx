'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2, X, ImagePlus } from 'lucide-react'
import { getJSON, sendJSON } from '../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { useConfirm } from '@/components/confirm-dialog'
import { Modal } from '@/components/modal'
import { PageSkeleton } from '../ui'
import { DataError } from '@/components/data-error'
import { useIsViewer } from '@/lib/dashboard-user'
import { formatRupiah } from '@/lib/utils'
import type { Bundle, BundleItem, Merchandise, TicketKatalogItem } from '@/lib/types'

type ItemDraft = { tipe: 'tiket' | 'merch'; ref_id: string; qty: number }

type FormState = {
  id?: string
  nama: string
  deskripsi: string
  gambar_url: string
  harga_bundle: number
  aktif: boolean
  tgl_mulai: string
  tgl_selesai: string
  kuota: number
  urutan: number
  items: ItemDraft[]
}

const emptyForm: FormState = {
  nama: '',
  deskripsi: '',
  gambar_url: '',
  harga_bundle: 0,
  aktif: true,
  tgl_mulai: '',
  tgl_selesai: '',
  kuota: 0,
  urutan: 0,
  items: [],
}

function toDateInput(value: string | null) {
  if (!value) return ''
  return value.slice(0, 10)
}

export default function PaketPage() {
  const confirm = useConfirm()
  const isViewer = useIsViewer()
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [tiket, setTiket] = useState<TicketKatalogItem[]>([])
  const [merch, setMerch] = useState<Merchandise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [itemTipe, setItemTipe] = useState<'tiket' | 'merch'>('tiket')
  const [itemRef, setItemRef] = useState('')
  const [itemQty, setItemQty] = useState(1)

  const load = useCallback(async () => {
    const [b, t, m] = await Promise.all([
      getJSON<Bundle[]>('/api/paket'),
      getJSON<TicketKatalogItem[]>('/api/ticket'),
      getJSON<Merchandise[]>('/api/merchandise'),
    ])
    setBundles(b)
    setTiket(t)
    setMerch(m)
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => { setError('Gagal memuat data paket'); console.error(e) })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  const tiketMap = useMemo(() => new Map(tiket.map((t) => [t.id, t])), [tiket])
  const merchMap = useMemo(() => new Map(merch.map((m) => [m.id, m])), [merch])

  function namaItem(item: BundleItem) {
    if (item.nama) return item.nama
    return item.tipe === 'tiket' ? tiketMap.get(item.ref_id)?.nama ?? 'Tiket' : merchMap.get(item.ref_id)?.nama ?? 'Merch'
  }

  function hargaItem(item: BundleItem) {
    if (item.harga_satuan != null) return Number(item.harga_satuan)
    if (item.tipe === 'tiket') return Number(tiketMap.get(item.ref_id)?.harga ?? 0)
    const m = merchMap.get(item.ref_id)
    return Number(m?.harga_po_umum ?? m?.harga_po ?? m?.harga ?? 0)
  }

  function openTambah() {
    setForm(emptyForm)
    setItemTipe('tiket')
    setItemRef('')
    setItemQty(1)
    setOpen(true)
  }

  function openEdit(b: Bundle) {
    setForm({
      id: b.id,
      nama: b.nama,
      deskripsi: b.deskripsi ?? '',
      gambar_url: b.gambar_url ?? '',
      harga_bundle: Number(b.harga_bundle),
      aktif: b.aktif,
      tgl_mulai: toDateInput(b.tgl_mulai),
      tgl_selesai: toDateInput(b.tgl_selesai),
      kuota: Number(b.kuota),
      urutan: Number(b.urutan),
      items: (b.items ?? []).map((i) => ({ tipe: i.tipe, ref_id: i.ref_id, qty: Number(i.qty) })),
    })
    setItemTipe('tiket')
    setItemRef('')
    setItemQty(1)
    setOpen(true)
  }

  function tambahItem() {
    if (!itemRef) { toast.error('Pilih item terlebih dahulu'); return }
    if (form.items.some((i) => i.tipe === itemTipe && i.ref_id === itemRef)) {
      toast.error('Item ini sudah ada di paket')
      return
    }
    setForm((f) => ({ ...f, items: [...f.items, { tipe: itemTipe, ref_id: itemRef, qty: Math.max(1, itemQty) }] }))
    setItemRef('')
    setItemQty(1)
  }

  function hapusItem(index: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }))
  }

  async function uploadGambar(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'bundle-images')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Gagal upload gambar')
      setForm((f) => ({ ...f, gambar_url: data.url }))
      toast.success('Gambar diupload')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setUploading(false)
    }
  }

  async function simpan() {
    if (!form.nama.trim()) { toast.error('Nama paket wajib diisi'); return }
    if (form.items.length === 0) { toast.error('Tambahkan minimal satu item'); return }
    setSaving(true)
    try {
      await sendJSON('/api/paket', 'POST', {
        ...form,
        tgl_mulai: form.tgl_mulai || null,
        tgl_selesai: form.tgl_selesai || null,
      })
      toast.success(form.id ? 'Paket diperbarui' : 'Paket dibuat')
      setOpen(false)
      await load()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function hapus(b: Bundle) {
    const ok = await confirm({
      title: 'Hapus paket?',
      description: `Paket "${b.nama}" akan dihapus permanen.`,
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      await sendJSON('/api/paket', 'DELETE', { id: b.id })
      toast.success('Paket dihapus')
      await load()
    } catch (e) {
      toast.error(String(e))
    }
  }

  if (loading) return <PageSkeleton />
  if (error) return <div className="flex justify-center"><DataError title={error} /></div>

  const refOptions = itemTipe === 'tiket' ? tiket.map((t) => ({ id: t.id, nama: t.nama })) : merch.map((m) => ({ id: m.id, nama: m.nama }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Paket Combo</h1>
          <p className="text-sm text-slate-500">Bundel tiket + merchandise dengan satu pembayaran.</p>
        </div>
        {!isViewer && (
          <button type="button" onClick={openTambah} className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
            <Plus className="h-4 w-4" /> Tambah Paket
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-slate-50 text-left border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">Paket</th>
                <th className="px-4 py-3 font-medium text-slate-600">Isi</th>
                <th className="px-4 py-3 font-medium text-slate-600">Harga</th>
                <th className="px-4 py-3 font-medium text-slate-600">Kuota</th>
                <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 font-medium text-slate-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bundles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    Belum ada paket combo.
                  </td>
                </tr>
              )}
              {bundles.map((b) => {
                const komponen = (b.items ?? []).reduce((sum, i) => sum + hargaItem(i) * Number(i.qty), 0)
                return (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {b.gambar_url ? (
                          <img src={b.gambar_url} alt={b.nama} className="h-12 w-12 rounded-lg border border-slate-200 object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-300"><ImagePlus className="h-5 w-5" /></div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-900">{b.nama}</p>
                          {b.deskripsi && <p className="text-xs text-slate-500 line-clamp-1">{b.deskripsi}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ul className="space-y-0.5 text-xs text-slate-600">
                        {(b.items ?? []).map((i) => (
                          <li key={i.id}>{i.qty}× {namaItem(i)} <span className="text-slate-400">({i.tipe === 'tiket' ? 'Tiket' : 'Merch'})</span></li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-primary-600">{formatRupiah(Number(b.harga_bundle))}</p>
                      {komponen > 0 && <p className="text-xs text-slate-400 line-through">{formatRupiah(komponen)}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{Number(b.kuota) > 0 ? Number(b.kuota) : '∞'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${b.aktif ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {b.aktif ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!isViewer && (
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => openEdit(b)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-primary-200 hover:text-primary-600" title="Edit"><Pencil className="h-4 w-4" /></button>
                          <button type="button" onClick={() => hapus(b)} className="rounded-lg border border-slate-200 p-2 text-red-600 hover:border-red-200 hover:bg-red-50" title="Hapus"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} panelClassName="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Paket' : 'Tambah Paket'}</h2>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nama Paket</label>
            <input value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Paket Hemat 1" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Deskripsi</label>
            <textarea value={form.deskripsi} onChange={(e) => setForm((f) => ({ ...f, deskripsi: e.target.value }))} rows={2} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Gambar</label>
            <div className="flex items-center gap-3">
              {form.gambar_url && <img src={form.gambar_url} alt="preview" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />}
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-primary-200">
                <ImagePlus className="h-4 w-4" /> {uploading ? 'Mengupload...' : 'Pilih Gambar'}
                <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadGambar(file) }} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Harga Paket</label>
              <input type="number" min={0} value={form.harga_bundle} onChange={(e) => setForm((f) => ({ ...f, harga_bundle: Number(e.target.value) }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Kuota (0 = unlimited)</label>
              <input type="number" min={0} value={form.kuota} onChange={(e) => setForm((f) => ({ ...f, kuota: Number(e.target.value) }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Mulai</label>
              <input type="date" value={form.tgl_mulai} onChange={(e) => setForm((f) => ({ ...f, tgl_mulai: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Selesai</label>
              <input type="date" value={form.tgl_selesai} onChange={(e) => setForm((f) => ({ ...f, tgl_selesai: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Urutan</label>
              <input type="number" value={form.urutan} onChange={(e) => setForm((f) => ({ ...f, urutan: Number(e.target.value) }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.aktif} onChange={(e) => setForm((f) => ({ ...f, aktif: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-primary-600" /> Aktif
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <p className="mb-2 text-sm font-medium text-slate-700">Isi Paket</p>
            <ul className="mb-3 space-y-1">
              {form.items.length === 0 && <li className="text-xs text-slate-400">Belum ada item.</li>}
              {form.items.map((item, index) => {
                const nama = item.tipe === 'tiket' ? tiketMap.get(item.ref_id)?.nama : merchMap.get(item.ref_id)?.nama
                return (
                  <li key={`${item.tipe}-${item.ref_id}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span>{item.qty}× {nama ?? 'Item'} <span className="text-xs text-slate-400">({item.tipe})</span></span>
                    <button type="button" onClick={() => hapusItem(index)} className="text-red-600 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                  </li>
                )
              })}
            </ul>
            <div className="flex flex-wrap items-end gap-2">
              <select value={itemTipe} onChange={(e) => { setItemTipe(e.target.value as 'tiket' | 'merch'); setItemRef('') }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="tiket">Tiket</option>
                <option value="merch">Merchandise</option>
              </select>
              <select value={itemRef} onChange={(e) => setItemRef(e.target.value)} className="min-w-[160px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">Pilih {itemTipe === 'tiket' ? 'tiket' : 'produk'}...</option>
                {refOptions.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
              </select>
              <input type="number" min={1} value={itemQty} onChange={(e) => setItemQty(Number(e.target.value))} className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <button type="button" onClick={tambahItem} className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100">Tambah</button>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Batal</button>
          <button type="button" onClick={simpan} disabled={saving} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </Modal>
    </div>
  )
}
