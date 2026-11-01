'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { sendJSON } from '../../../../api'

type FormState = {
  nama: string
  deskripsi: string
  harga: number
  jumlah_orang: number
  is_hari_h: boolean
  kuota: number
  selesai_jual: string
  aktif: boolean
}

function emptyForm(isHariH = false): FormState {
  return {
    nama: '',
    deskripsi: '',
    harga: 0,
    jumlah_orang: 1,
    is_hari_h: isHariH,
    kuota: isHariH ? 10 : 0,
    selesai_jual: '',
    aktif: true,
  }
}

export default function TipeCreatePage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(emptyForm())
  const [submitting, setSubmitting] = useState(false)

  async function simpan() {
    if (!form.nama.trim() || !form.harga) {
      toast.error('Nama dan harga harus diisi')
      return
    }
    setSubmitting(true)
    try {
      const data = await sendJSON('/api/ticket', 'POST', {
        ...form,
        nama: form.nama.trim(),
        deskripsi: form.deskripsi.trim() || null,
        harga: Number(form.harga),
        jumlah_orang: Number(form.jumlah_orang) || 1,
        kuota: form.is_hari_h ? Number(form.kuota) || 10 : 0,
        selesai_jual:
          form.is_hari_h && form.selesai_jual ? new Date(form.selesai_jual).toISOString() : null,
      })
      toast.success('Tipe tiket berhasil ditambahkan')
      router.push(`/dankelola/ticket/tipe/${data.id}/edit`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const input =
    'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/dankelola/ticket/tahap"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tambah Tipe Tiket</h1>
          <p className="text-sm text-slate-500">Buat tipe tiket baru untuk dijual di halaman publik.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Nama Tiket</label>
            <input
              placeholder="Contoh: Reguler, VIP"
              className={input}
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Harga Dasar (Rp)</label>
            <input
              type="number"
              min={0}
              placeholder="Harga"
              className={input}
              value={form.harga || ''}
              onChange={(e) => setForm({ ...form, harga: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Berlaku untuk (orang)</label>
            <input
              type="number"
              min={1}
              className={input}
              value={form.jumlah_orang}
              onChange={(e) => setForm({ ...form, jumlah_orang: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Deskripsi (opsional)</label>
            <input
              placeholder="Contoh: Tiket masuk untuk 2 orang"
              className={input}
              value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_hari_h}
              onChange={(e) =>
                setForm({
                  ...form,
                  is_hari_h: e.target.checked,
                  kuota: e.target.checked ? form.kuota || 10 : 0,
                })
              }
            />
            Tiket Hari H (kuota terbatas)
          </label>

          {form.is_hari_h && (
            <div className="grid gap-3 md:grid-cols-2 pl-6">
              <div>
                <label className="mb-1 block text-sm font-medium">Kuota</label>
                <input
                  type="number"
                  min={1}
                  className={input}
                  value={form.kuota}
                  onChange={(e) => setForm({ ...form, kuota: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Tutup Penjualan</label>
                <input
                  type="datetime-local"
                  className={input}
                  value={form.selesai_jual}
                  onChange={(e) => setForm({ ...form, selesai_jual: e.target.value })}
                />
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.aktif}
              onChange={(e) => setForm({ ...form, aktif: e.target.checked })}
            />
            Buka order sekarang
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href="/dankelola/ticket/tahap"
            className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Batal
          </Link>
          <button
            onClick={simpan}
            disabled={submitting || !form.nama.trim() || !form.harga}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
