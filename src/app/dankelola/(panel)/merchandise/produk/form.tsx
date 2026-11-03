'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Image as ImageIcon, Plus, Trash2 } from 'lucide-react'
import { getJSON, sendJSON } from '../../../api'
import { PageSkeleton } from '../../ui'
import type { DiskonRule, Merchandise } from '@/lib/types'
import { normalizeDiskon } from '@/lib/merch-diskon'

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'

function toLocalInput(value: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : null
}

export default function ProdukForm({ id }: { id?: string }) {
  const router = useRouter()
  const [form, setForm] = useState({ nama: '', deskripsi: '', warna: '', harga: 0, harga_po: 0, po_mulai: '', po_selesai: '', po_unlimited: true, po_stok: 0, stok: 0, stok_unlimited: false, gambar_url: '', aktif: true, diskon: [] as DiskonRule[] })
  const [foto, setFoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(id))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true
    getJSON<Merchandise[]>('/api/merchandise')
      .then((items) => {
        if (!active) return
        const found = items.find((item) => item.id === id)
        if (!found) {
          toast.error('Produk tidak ditemukan')
          router.push('/dankelola/merchandise/produk')
          return
        }
        setForm({
          nama: found.nama,
          deskripsi: found.deskripsi ?? '',
          warna: found.warna ?? '',
          harga: Number(found.harga),
          harga_po: Number(found.harga_po ?? 0),
          po_mulai: toLocalInput(found.po_mulai),
          po_selesai: toLocalInput(found.po_selesai),
          po_unlimited: found.po_unlimited ?? true,
          po_stok: Number(found.po_stok ?? 0),
          stok: Number(found.stok),
          stok_unlimited: Boolean(found.stok_unlimited),
          gambar_url: found.gambar_url ?? '',
          aktif: found.aktif,
          diskon: normalizeDiskon(found.diskon),
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

  useEffect(() => {
    if (foto) {
      const url = URL.createObjectURL(foto)
      setPreview(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreview(form.gambar_url || null)
  }, [foto, form.gambar_url])

  function tambahDiskon() {
    setForm({
      ...form,
      diskon: [...form.diskon, { min_qty: 2, tipe: 'persen', nilai: 0, berlaku_po: true, berlaku_hari_h: true }],
    })
  }

  function updateDiskon(index: number, patch: Partial<DiskonRule>) {
    setForm({
      ...form,
      diskon: form.diskon.map((rule, i) => i === index ? { ...rule, ...patch } : rule),
    })
  }

  function hapusDiskon(index: number) {
    setForm({ ...form, diskon: form.diskon.filter((_, i) => i !== index) })
  }

  async function simpan(e: FormEvent) {
    e.preventDefault()
    if (!form.nama.trim()) {
      toast.error('Nama wajib diisi')
      return
    }
    if (!form.po_unlimited && form.po_stok < 1) {
      toast.error('Slot pre-order minimal 1')
      return
    }
    if (form.po_mulai || form.po_selesai) {
      if (!form.po_mulai || !form.po_selesai) {
        toast.error('Tanggal mulai dan selesai pre-order wajib diisi')
        return
      }
      if (!form.harga_po) {
        toast.error('Harga pre-order wajib diisi jika jadwal diatur')
        return
      }
      if (new Date(form.po_selesai).getTime() <= new Date(form.po_mulai).getTime()) {
        toast.error('Tanggal selesai harus setelah tanggal mulai')
        return
      }
    }
    for (const [index, rule] of form.diskon.entries()) {
      const label = `Aturan diskon #${index + 1}`
      if (rule.min_qty < 2) {
        toast.error(`${label}: minimal qty 2`)
        return
      }
      if (rule.nilai <= 0) {
        toast.error(`${label}: nilai diskon harus lebih dari 0`)
        return
      }
      if (rule.tipe === 'persen' && rule.nilai > 100) {
        toast.error(`${label}: diskon persen maksimal 100`)
        return
      }
      if (!rule.berlaku_po && !rule.berlaku_hari_h) {
        toast.error(`${label}: pilih Pre-Order atau Hari H`)
        return
      }
    }

    setSaving(true)
    try {
      let gambarUrl = form.gambar_url.trim() || null
      if (foto) {
        const fd = new FormData()
        fd.append('file', foto)
        fd.append('folder', 'merchandise-images')
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal upload foto produk')
        gambarUrl = data.url || null
      }

      await sendJSON('/api/merchandise', 'POST', {
        ...(id ? { id } : {}),
        nama: form.nama.trim(),
        deskripsi: form.deskripsi.trim() || null,
        warna: form.warna.trim() || null,
        harga: Number(form.harga) || 0,
        harga_po: Number(form.harga_po) || null,
        po_mulai: form.po_mulai ? toIso(form.po_mulai) : null,
        po_selesai: form.po_selesai ? toIso(form.po_selesai) : null,
        po_unlimited: form.po_unlimited,
        po_stok: form.po_unlimited ? 0 : Number(form.po_stok) || 0,
        stok: form.stok_unlimited ? 0 : Number(form.stok) || 0,
        stok_unlimited: form.stok_unlimited,
        gambar_url: gambarUrl,
        aktif: form.aktif,
        diskon: normalizeDiskon(form.diskon),
      })
      toast.success(id ? 'Produk diperbarui' : 'Produk ditambahkan')
      router.push('/dankelola/merchandise/produk')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {id ? 'Edit Produk' : 'Tambah Produk'}
        </h1>
        <p className="text-sm text-slate-500">
          {id ? 'Perbarui data produk merchandise.' : 'Tambahkan produk merchandise baru.'}
        </p>
      </div>

      <form onSubmit={simpan} className="max-w-6xl space-y-4 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {preview ? (
              <img src={preview} alt="Foto produk" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-7 w-7 text-slate-300" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="foto" className="mb-1 block text-xs font-medium text-slate-500">Foto Produk</label>
            <input
              id="foto"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
            />
            <p className="mt-1 text-xs text-slate-400">JPG/PNG/WebP maks. 5MB.</p>
            {preview && (
              <button
                type="button"
                onClick={() => {
                  setFoto(null)
                  setForm({ ...form, gambar_url: '' })
                }}
                className="mt-1 text-xs font-medium text-red-600 hover:underline"
              >
                Hapus foto
              </button>
            )}
          </div>
        </div>
        <div>
          <label htmlFor="nama" className="mb-1 block text-xs font-medium text-slate-500">Nama Produk</label>
          <input
            id="nama"
            className={input}
            placeholder="cth: Kaos In4Days XI"
            value={form.nama}
            onChange={(e) => setForm({ ...form, nama: e.target.value })}
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="warna" className="mb-1 block text-xs font-medium text-slate-500">Warna (opsional)</label>
          <input
            id="warna"
            className={input}
            placeholder="cth: Hitam, Putih"
            value={form.warna}
            onChange={(e) => setForm({ ...form, warna: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="deskripsi" className="mb-1 block text-xs font-medium text-slate-500">Deskripsi (opsional)</label>
          <textarea
            id="deskripsi"
            rows={3}
            className={input}
            placeholder="Deskripsi singkat produk"
            value={form.deskripsi}
            onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="harga" className="mb-1 block text-xs font-medium text-slate-500">Harga Hari H (Rp) — opsional</label>
            <input
              id="harga"
              type="number"
              min={0}
              className={input}
              placeholder="Kosongkan jika hanya pre-order"
              value={form.harga || ''}
              onChange={(e) => setForm({ ...form, harga: Number(e.target.value) })}
            />
          </div>
          <div>
            <label htmlFor="harga_po" className="mb-1 block text-xs font-medium text-slate-500">Harga Pre-Order (Rp)</label>
            <input
              id="harga_po"
              type="number"
              min={0}
              className={input}
              placeholder="Kosongkan jika tidak ada PO"
              value={form.harga_po || ''}
              onChange={(e) => setForm({ ...form, harga_po: Number(e.target.value) })}
            />
          </div>
          <div>
            <label htmlFor="stok" className="mb-1 block text-xs font-medium text-slate-500">Stok Hari H</label>
            <input
              id="stok"
              type="number"
              min={0}
              className={`${input} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`}
              placeholder={form.stok_unlimited ? 'Tanpa batas' : 'cth: 100'}
              value={form.stok_unlimited ? '' : form.stok || ''}
              disabled={form.stok_unlimited}
              onChange={(e) => setForm({ ...form, stok: Number(e.target.value) })}
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.stok_unlimited}
                onChange={(e) => setForm({ ...form, stok_unlimited: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Stok tidak terbatas
            </label>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-sm font-medium text-slate-700">Jadwal Pre-Order</p>
          <p className="mt-0.5 text-xs text-slate-500">Kosongkan tanggal untuk menonaktifkan pre-order produk ini.</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="po_mulai" className="mb-1 block text-xs font-medium text-slate-500">Mulai PO</label>
              <input
                id="po_mulai"
                type="datetime-local"
                className={input}
                value={form.po_mulai}
                onChange={(e) => setForm({ ...form, po_mulai: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="po_selesai" className="mb-1 block text-xs font-medium text-slate-500">Selesai PO</label>
              <input
                id="po_selesai"
                type="datetime-local"
                className={input}
                value={form.po_selesai}
                onChange={(e) => setForm({ ...form, po_selesai: e.target.value })}
              />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-sm font-medium text-slate-700">Slot Pre-Order</p>
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.po_unlimited}
              onChange={(e) => setForm({ ...form, po_unlimited: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            Slot tidak terbatas
          </label>
          {!form.po_unlimited && (
            <div className="mt-3 max-w-xs">
              <label htmlFor="po_stok" className="mb-1 block text-xs font-medium text-slate-500">Batas Slot</label>
              <input
                id="po_stok"
                type="number"
                min={1}
                className={input}
                placeholder="cth: 100"
                value={form.po_stok || ''}
                onChange={(e) => setForm({ ...form, po_stok: Number(e.target.value) })}
              />
            </div>
          )}
        </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Aturan Diskon per Qty</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Diskon otomatis saat qty memenuhi minimal. Persen dihitung dari subtotal, nominal dipotong sekali per baris produk.
              </p>
            </div>
            <button
              type="button"
              onClick={tambahDiskon}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" /> Tambah Aturan
            </button>
          </div>
          {form.diskon.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">Belum ada aturan diskon.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {form.diskon.map((rule, index) => (
                <div key={index} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Minimal Qty</label>
                      <input
                        type="number"
                        min={2}
                        className={input}
                        value={rule.min_qty || ''}
                        onChange={(e) => updateDiskon(index, { min_qty: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Tipe Diskon</label>
                      <select
                        className={input}
                        value={rule.tipe}
                        onChange={(e) => updateDiskon(index, { tipe: e.target.value === 'nominal' ? 'nominal' : 'persen' })}
                      >
                        <option value="persen">Persen (%)</option>
                        <option value="nominal">Nominal (Rp)</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        Nilai {rule.tipe === 'persen' ? '(%)' : '(Rp)'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={rule.tipe === 'persen' ? 100 : undefined}
                        className={input}
                        value={rule.nilai || ''}
                        onChange={(e) => updateDiskon(index, { nilai: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={rule.berlaku_po}
                          onChange={(e) => updateDiskon(index, { berlaku_po: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                        Pre-Order
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={rule.berlaku_hari_h}
                          onChange={(e) => updateDiskon(index, { berlaku_hari_h: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                        Hari H
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => hapusDiskon(index)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.aktif}
            onChange={(e) => setForm({ ...form, aktif: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          Aktif
        </label>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Link
            href="/dankelola/merchandise/produk"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={saving || !form.nama.trim()}
            className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  )
}
