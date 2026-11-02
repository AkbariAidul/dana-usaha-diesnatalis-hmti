'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { PageSkeleton } from '../../ui'
import type { Merchandise } from '@/lib/types'

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'

export default function ProdukForm({ id }: { id?: string }) {
  const router = useRouter()
  const [form, setForm] = useState({ nama: '', deskripsi: '', harga: 0, stok: 0, aktif: true })
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

  async function simpan(e: FormEvent) {
    e.preventDefault()
    if (!form.nama.trim() || !form.harga) {
      toast.error('Nama dan harga wajib diisi')
      return
    }
    setSaving(true)
    try {
      await sendJSON('/api/merchandise', 'POST', {
        ...(id ? { id } : {}),
        nama: form.nama.trim(),
        deskripsi: form.deskripsi.trim() || null,
        harga: Number(form.harga),
        stok: Number(form.stok) || 0,
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
              className={input}
              placeholder="cth: 100"
              value={form.stok || ''}
              onChange={(e) => setForm({ ...form, stok: Number(e.target.value) })}
            />
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
