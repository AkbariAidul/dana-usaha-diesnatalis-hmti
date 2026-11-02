'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Image as ImageIcon } from 'lucide-react'
import { getJSON, sendJSON } from '../../../api'
import { PageSkeleton } from '../../ui'
import type { Merchandise } from '@/lib/types'

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'

export default function ProdukForm({ id }: { id?: string }) {
  const router = useRouter()
  const [form, setForm] = useState({ nama: '', deskripsi: '', harga: 0, stok: 0, stok_unlimited: false, gambar_url: '', aktif: true })
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
          harga: Number(found.harga),
          stok: Number(found.stok),
          stok_unlimited: Boolean(found.stok_unlimited),
          gambar_url: found.gambar_url ?? '',
          aktif: found.aktif,
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

  async function simpan(e: FormEvent) {
    e.preventDefault()
    if (!form.nama.trim() || !form.harga) {
      toast.error('Nama dan harga wajib diisi')
      return
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
        harga: Number(form.harga),
        stok: form.stok_unlimited ? 0 : Number(form.stok) || 0,
        stok_unlimited: form.stok_unlimited,
        gambar_url: gambarUrl,
        aktif: form.aktif,
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

      <form onSubmit={simpan} className="max-w-3xl space-y-4 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="harga" className="mb-1 block text-xs font-medium text-slate-500">Harga (Rp)</label>
            <input
              id="harga"
              type="number"
              min={0}
              className={input}
              placeholder="cth: 75000"
              value={form.harga || ''}
              onChange={(e) => setForm({ ...form, harga: Number(e.target.value) })}
            />
          </div>
          <div>
            <label htmlFor="stok" className="mb-1 block text-xs font-medium text-slate-500">Stok</label>
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
            disabled={saving || !form.nama.trim() || !form.harga}
            className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  )
}
