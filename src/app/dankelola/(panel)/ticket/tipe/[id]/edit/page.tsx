'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { getJSON, sendJSON } from '../../../../../api'
import type { TicketKatalogItem } from '@/lib/types'

type FormState = {
  id?: string
  nama: string
  deskripsi: string
  harga: number
  jumlah_orang: number
  is_hari_h: boolean
  kuota: number
  selesai_jual: string
  aktif: boolean
}

function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TipeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [ticket, setTicket] = useState<TicketKatalogItem | null>(null)
  const [form, setForm] = useState<FormState>({
    nama: '',
    deskripsi: '',
    harga: 0,
    jumlah_orang: 1,
    is_hari_h: false,
    kuota: 10,
    selesai_jual: '',
    aktif: true,
  })
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const resolved = await params
      const data = await getJSON<TicketKatalogItem>(`/api/ticket/${resolved.id}`)
      setTicket(data)
      setForm({
        id: data.id,
        nama: data.nama,
        deskripsi: data.deskripsi ?? '',
        harga: Number(data.harga),
        jumlah_orang: Number(data.jumlah_orang ?? 1),
        is_hari_h: Boolean(data.is_hari_h),
        kuota: Number(data.kuota ?? 0) || 10,
        selesai_jual: toLocalInput(data.selesai_jual),
        aktif: data.aktif,
      })
      setLoading(false)
    })()
  }, [params])

  async function simpan() {
    if (!form.nama.trim() || !form.harga) {
      toast.error('Nama dan harga harus diisi')
      return
    }
    setSubmitting(true)
    try {
      await sendJSON('/api/ticket', 'POST', {
        ...form,
        nama: form.nama.trim(),
        deskripsi: form.deskripsi.trim() || null,
        harga: Number(form.harga),
        jumlah_orang: Number(form.jumlah_orang) || 1,
        kuota: form.is_hari_h ? Number(form.kuota) || 10 : 0,
        selesai_jual:
          form.is_hari_h && form.selesai_jual ? new Date(form.selesai_jual).toISOString() : null,
      })
      toast.success('Tipe tiket berhasil diperbarui')
      router.push('/dankelola/ticket/tahap')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600" />
      </div>
    )
  }

  const input =
    'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'

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
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Edit Tipe Tiket</h1>
          <p className="text-sm text-slate-500">{ticket?.nama}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Nama Tiket</label>
            <input
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
            Buka order
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
            className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  )
}
