'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { sendJSON } from '../../../../api'

type FormState = {
  tiket_tipe_id: string
  nama: string
  tanggal_mulai: string
  tanggal_selesai: string
  harga: number
}

export default function PeriodeCreatePage() {
  const router = useRouter()
  const [tipeList, setTipeList] = useState<{ id: string; nama: string }[]>([])
  const [form, setForm] = useState<FormState>({
    tiket_tipe_id: '',
    nama: '',
    tanggal_mulai: '',
    tanggal_selesai: '',
    harga: 0,
  })
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ticket')
      .then((r) => r.json())
      .then((data) => {
        setTipeList((data as { id: string; nama: string }[]).map((t) => ({ id: t.id, nama: t.nama })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function simpan() {
    if (!form.tiket_tipe_id) {
      toast.error('Pilih tipe tiket')
      return
    }
    if (!form.tanggal_mulai || !form.tanggal_selesai) {
      toast.error('Tanggal mulai dan selesai wajib diisi')
      return
    }
    if (form.tanggal_selesai < form.tanggal_mulai) {
      toast.error('Tanggal selesai harus setelah tanggal mulai')
      return
    }
    if (!form.harga || form.harga < 0) {
      toast.error('Harga harus diisi')
      return
    }
    setSubmitting(true)
    try {
      await sendJSON('/api/ticket/periode', 'POST', {
        ...form,
        nama: form.nama.trim() || null,
        harga: Number(form.harga),
      })
      toast.success('Periode harga berhasil ditambahkan')
      router.push('/dankelola/ticket/periode')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      </div>
    )
  }

  const input =
    'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/dankelola/ticket/periode"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tambah Periode Harga</h1>
          <p className="text-sm text-slate-500">Buat periode harga baru untuk salah satu tipe tiket.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Tipe Tiket</label>
            <select
              className={input}
              value={form.tiket_tipe_id}
              onChange={(e) => setForm({ ...form, tiket_tipe_id: e.target.value })}
            >
              <option value="">-- Pilih tipe tiket --</option>
              {tipeList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nama}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nama Periode (opsional)</label>
            <input
              placeholder="Contoh: Early Bird"
              className={input}
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Tanggal Mulai</label>
            <input
              type="date"
              className={input}
              value={form.tanggal_mulai}
              onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Tanggal Selesai</label>
            <input
              type="date"
              className={input}
              value={form.tanggal_selesai}
              onChange={(e) => setForm({ ...form, tanggal_selesai: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Harga (Rp)</label>
          <input
            type="number"
            min={0}
            className={input}
            value={form.harga || ''}
            onChange={(e) => setForm({ ...form, harga: Number(e.target.value) })}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href="/dankelola/ticket/periode"
            className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Batal
          </Link>
          <button
            onClick={simpan}
            disabled={
              submitting ||
              !form.tiket_tipe_id ||
              !form.tanggal_mulai ||
              !form.tanggal_selesai ||
              !form.harga
            }
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
