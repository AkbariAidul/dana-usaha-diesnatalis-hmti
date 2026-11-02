'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../../../api'
import { PageSkeleton } from '../../../../ui'
import type { Merchandise } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'

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

export default function JadwalPoEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [produk, setProduk] = useState<Merchandise | null>(null)
  const [form, setForm] = useState({ po_mulai: '', po_selesai: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    getJSON<Merchandise[]>('/api/merchandise')
      .then((items) => {
        if (!active) return
        const found = items.find((item) => item.id === id)
        if (!found) {
          toast.error('Produk tidak ditemukan')
          router.push('/dankelola/merchandise/jadwal')
          return
        }
        setProduk(found)
        setForm({
          po_mulai: toLocalInput(found.po_mulai),
          po_selesai: toLocalInput(found.po_selesai),
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
    const aktif = Boolean(form.po_mulai || form.po_selesai)
    if (aktif && (!form.po_mulai || !form.po_selesai)) {
      toast.error('Tanggal mulai dan selesai wajib diisi')
      return
    }
    if (aktif && new Date(form.po_selesai).getTime() <= new Date(form.po_mulai).getTime()) {
      toast.error('Tanggal selesai harus setelah tanggal mulai')
      return
    }
    setSaving(true)
    try {
      await sendJSON('/api/merchandise', 'POST', {
        id,
        po_mulai: aktif ? toIso(form.po_mulai) : null,
        po_selesai: aktif ? toIso(form.po_selesai) : null,
      })
      toast.success(aktif ? 'Jadwal PO disimpan' : 'Jadwal PO dinonaktifkan')
      router.push('/dankelola/merchandise/jadwal')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageSkeleton />
  if (!produk) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Atur Jadwal PO</h1>
        <p className="text-sm text-slate-500">{produk.nama}</p>
      </div>

      <form onSubmit={simpan} className="max-w-4xl space-y-5 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          Jadwal hanya mengatur rentang tanggal pre-order. Harga dan slot mengikuti menu Produk &amp; Harga.
          Kosongkan tanggal untuk menonaktifkan pre-order produk ini.
        </div>

        {!produk.harga_po && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Harga pre-order belum diisi. Atur di{' '}
            <Link href={`/dankelola/merchandise/produk/${id}/edit`} className="font-medium underline">
              Produk &amp; Harga
            </Link>{' '}
            agar PO tampil di halaman publik.
          </div>
        )}

        <p className="text-sm text-slate-500">
          Harga PO saat ini: <span className="font-medium text-slate-900">{produk.harga_po ? formatRupiah(Number(produk.harga_po)) : '-'}</span>
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
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

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Link
            href="/dankelola/merchandise/jadwal"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  )
}
