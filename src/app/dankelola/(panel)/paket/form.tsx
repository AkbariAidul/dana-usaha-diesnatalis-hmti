'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ImagePlus, Plus, Trash2 } from 'lucide-react'
import { getJSON, sendJSON } from '../../api'
import { PageSkeleton } from '../ui'
import { formatRupiah } from '@/lib/utils'
import type { Bundle, Merchandise, TicketKatalogItem } from '@/lib/types'

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

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'

function toDateInput(value: string | null) {
  if (!value) return ''
  return value.slice(0, 10)
}

export default function PaketForm({ id }: { id?: string }) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [tiket, setTiket] = useState<TicketKatalogItem[]>([])
  const [merch, setMerch] = useState<Merchandise[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [itemTipe, setItemTipe] = useState<'tiket' | 'merch'>('tiket')
  const [itemRef, setItemRef] = useState('')
  const [itemQty, setItemQty] = useState(1)

  useEffect(() => {
    let active = true
    Promise.all([
      getJSON<Bundle[]>('/api/paket'),
      getJSON<TicketKatalogItem[]>('/api/ticket'),
      getJSON<Merchandise[]>('/api/merchandise'),
    ])
      .then(([bundles, t, m]) => {
        if (!active) return
        setTiket(t)
        setMerch(m)
        if (!id) return
        const found = bundles.find((b) => b.id === id)
        if (!found) {
          toast.error('Paket tidak ditemukan')
          router.push('/dankelola/paket')
          return
        }
        setForm({
          id: found.id,
          nama: found.nama,
          deskripsi: found.deskripsi ?? '',
          gambar_url: found.gambar_url ?? '',
          harga_bundle: Number(found.harga_bundle),
          aktif: found.aktif,
          tgl_mulai: toDateInput(found.tgl_mulai),
          tgl_selesai: toDateInput(found.tgl_selesai),
          kuota: Number(found.kuota),
          urutan: Number(found.urutan),
          items: (found.items ?? []).map((i) => ({ tipe: i.tipe, ref_id: i.ref_id, qty: Number(i.qty) })),
        })
      })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, router])

  const tiketMap = useMemo(() => new Map(tiket.map((t) => [t.id, t])), [tiket])
  const merchMap = useMemo(() => new Map(merch.map((m) => [m.id, m])), [merch])

  function hargaItem(item: ItemDraft) {
    if (item.tipe === 'tiket') return Number(tiketMap.get(item.ref_id)?.harga ?? 0)
    const m = merchMap.get(item.ref_id)
    return Number(m?.harga_po_umum ?? m?.harga_po ?? m?.harga ?? 0)
  }

  const totalKomponen = form.items.reduce((sum, i) => sum + hargaItem(i) * Number(i.qty), 0)
  const refOptions = itemTipe === 'tiket'
    ? tiket.map((t) => ({ id: t.id, nama: t.nama }))
    : merch.map((m) => ({ id: m.id, nama: m.nama }))

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

  async function simpan(e: FormEvent) {
    e.preventDefault()
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
      router.push('/dankelola/paket')
      router.refresh()
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {id ? 'Edit Paket' : 'Tambah Paket'}
        </h1>
        <p className="text-sm text-slate-500">
          {id ? 'Perbarui isi dan harga paket combo.' : 'Susun paket combo tiket + merchandise.'}
        </p>
      </div>

      <form onSubmit={simpan} className="w-full space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm lg:col-span-2">
            <div>
              <label htmlFor="nama" className="mb-1 block text-xs font-medium text-slate-500">Nama Paket</label>
              <input id="nama" className={input} placeholder="cth: Paket Hemat 1" value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} autoFocus />
            </div>
            <div>
              <label htmlFor="deskripsi" className="mb-1 block text-xs font-medium text-slate-500">Deskripsi (opsional)</label>
              <textarea id="deskripsi" rows={2} className={input} placeholder="Deskripsi singkat paket" value={form.deskripsi} onChange={(e) => setForm((f) => ({ ...f, deskripsi: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Gambar Paket</label>
              <div className="flex items-center gap-3">
                <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {form.gambar_url ? (
                    <img src={form.gambar_url} alt="Pratinjau paket" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-7 w-7 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-primary-200">
                    <ImagePlus className="h-4 w-4" /> {uploading ? 'Mengupload...' : 'Pilih Gambar'}
                    <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadGambar(file) }} />
                  </label>
                  <p className="mt-1 text-xs text-slate-400">JPG/PNG/WebP maks. 5MB.</p>
                  {form.gambar_url && (
                    <button type="button" onClick={() => setForm((f) => ({ ...f, gambar_url: '' }))} className="mt-1 text-xs font-medium text-red-600 hover:underline">
                      Hapus gambar
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="harga_bundle" className="mb-1 block text-xs font-medium text-slate-500">Harga Paket (Rp)</label>
                <input id="harga_bundle" type="number" min={0} className={input} value={form.harga_bundle || ''} onChange={(e) => setForm((f) => ({ ...f, harga_bundle: Number(e.target.value) }))} />
              </div>
              <div>
                <label htmlFor="kuota" className="mb-1 block text-xs font-medium text-slate-500">Kuota (0 = unlimited)</label>
                <input id="kuota" type="number" min={0} className={input} value={form.kuota || ''} onChange={(e) => setForm((f) => ({ ...f, kuota: Number(e.target.value) }))} />
              </div>
              <div>
                <label htmlFor="tgl_mulai" className="mb-1 block text-xs font-medium text-slate-500">Mulai</label>
                <input id="tgl_mulai" type="date" className={input} value={form.tgl_mulai} onChange={(e) => setForm((f) => ({ ...f, tgl_mulai: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="tgl_selesai" className="mb-1 block text-xs font-medium text-slate-500">Selesai</label>
                <input id="tgl_selesai" type="date" className={input} value={form.tgl_selesai} onChange={(e) => setForm((f) => ({ ...f, tgl_selesai: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="urutan" className="mb-1 block text-xs font-medium text-slate-500">Urutan</label>
                <input id="urutan" type="number" className={input} value={form.urutan || ''} onChange={(e) => setForm((f) => ({ ...f, urutan: Number(e.target.value) }))} />
              </div>
              <label className="flex items-end gap-2 pb-2.5 text-sm text-slate-700">
                <input type="checkbox" checked={form.aktif} onChange={(e) => setForm((f) => ({ ...f, aktif: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-primary-600" /> Aktif
              </label>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-900">Ringkasan</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Jumlah item</span>
                <span className="font-medium text-slate-900">{form.items.reduce((s, i) => s + Number(i.qty), 0)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Harga normal</span>
                <span className="text-slate-700 line-through">{formatRupiah(totalKomponen)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Harga paket</span>
                <span className="font-semibold text-primary-600">{formatRupiah(form.harga_bundle)}</span>
              </div>
              {totalKomponen > form.harga_bundle && (
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                  <span className="text-slate-500">Hemat</span>
                  <span className="font-medium text-green-600">{formatRupiah(totalKomponen - form.harga_bundle)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-900">Isi Paket</p>
          <p className="mt-0.5 text-xs text-slate-500">Pilih tiket dan merchandise yang didapat pembeli dalam satu paket.</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-1.5">
              {form.items.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">Belum ada item.</p>
              )}
              {form.items.map((item, index) => {
                const nama = item.tipe === 'tiket' ? tiketMap.get(item.ref_id)?.nama : merchMap.get(item.ref_id)?.nama
                return (
                  <div key={`${item.tipe}-${item.ref_id}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      {item.qty}× {nama ?? 'Item'} <span className="text-xs text-slate-400">({item.tipe === 'tiket' ? 'Tiket' : 'Merch'})</span>
                    </span>
                    <button type="button" onClick={() => hapusItem(index)} className="ml-2 shrink-0 text-red-600 hover:text-red-700" title="Hapus item">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <div className="flex flex-wrap items-end gap-2">
                <select value={itemTipe} onChange={(e) => { setItemTipe(e.target.value as 'tiket' | 'merch'); setItemRef('') }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option value="tiket">Tiket</option>
                  <option value="merch">Merchandise</option>
                </select>
                <select value={itemRef} onChange={(e) => setItemRef(e.target.value)} className="min-w-[160px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option value="">Pilih {itemTipe === 'tiket' ? 'tiket' : 'produk'}...</option>
                  {refOptions.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
                </select>
                <input type="number" min={1} value={itemQty} onChange={(e) => setItemQty(Number(e.target.value))} className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" aria-label="Qty" />
                <button type="button" onClick={tambahItem} className="inline-flex items-center gap-1 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100">
                  <Plus className="h-4 w-4" /> Tambah
                </button>
              </div>
              <p className="text-xs text-slate-400">Harga item hanya untuk pembanding. Pembeli membayar harga paket.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Link href="/dankelola/paket" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
            Batal
          </Link>
          <button type="submit" disabled={saving || !form.nama.trim()} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  )
}
