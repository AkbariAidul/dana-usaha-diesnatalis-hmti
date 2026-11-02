'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { PageSkeleton } from '../../ui'

type Pengurus = {
  id: string
  nama: string
  divisi: string | null
  aktif: boolean
}

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'

export default function PengurusForm({ id }: { id?: string }) {
  const router = useRouter()
  const [form, setForm] = useState({ nama: '', divisi: '', aktif: true })
  const [loading, setLoading] = useState(Boolean(id))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true
    getJSON<Pengurus[]>('/api/pengurus')
      .then((items) => {
        if (!active) return
        const found = items.find((item) => item.id === id)
        if (!found) {
          toast.error('Pengurus tidak ditemukan')
          router.push('/dankelola/merchandise/pengurus')
          return
        }
        setForm({ nama: found.nama, divisi: found.divisi ?? '', aktif: found.aktif })
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
    if (!form.nama.trim()) {
      toast.error('Nama wajib diisi')
      return
    }
    setSaving(true)
    try {
      await sendJSON(
        id ? `/api/pengurus/${id}` : '/api/pengurus',
        id ? 'PATCH' : 'POST',
        {
          nama: form.nama.trim(),
          divisi: form.divisi.trim() || null,
          aktif: form.aktif,
        }
      )
      toast.success(id ? 'Pengurus diperbarui' : 'Pengurus ditambahkan')
      router.push('/dankelola/merchandise/pengurus')
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
          {id ? 'Edit Pengurus' : 'Tambah Pengurus'}
        </h1>
        <p className="text-sm text-slate-500">
          {id ? 'Perbarui data pengurus.' : 'Tambahkan pengurus baru untuk pilihan PO merchandise.'}
        </p>
      </div>

      <form onSubmit={simpan} className="max-w-2xl space-y-4 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="nama" className="mb-1 block text-xs font-medium text-slate-500">Nama</label>
          <input
            id="nama"
            className={input}
            placeholder="Nama pengurus"
            value={form.nama}
            onChange={(e) => setForm({ ...form, nama: e.target.value })}
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="divisi" className="mb-1 block text-xs font-medium text-slate-500">Divisi (opsional)</label>
          <input
            id="divisi"
            className={input}
            placeholder="cth: Acara"
            value={form.divisi}
            onChange={(e) => setForm({ ...form, divisi: e.target.value })}
          />
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
            href="/dankelola/merchandise/pengurus"
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
