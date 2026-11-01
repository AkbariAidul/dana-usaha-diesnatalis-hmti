'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { sendJSON } from '../../../../api'
import { ChevronLeft } from 'lucide-react'
import type { TicketKatalogItem } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'

type FormState = {
  nama: string
  deskripsi: string
  harga: number
  jumlah_orang: number
  aktif: boolean
  is_hari_h: boolean
  kuota: number
  selesai_jual: string
}

function emptyForm(): FormState {
  return { nama: '', deskripsi: '', harga: 0, jumlah_orang: 1, aktif: true, is_hari_h: false, kuota: 10, selesai_jual: '' }
}

function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TipeCreatePage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(emptyForm())
  const [submitting, setSubmitting] = useState(false)

  async function simpan() {
    if (!form.nama.trim() || !form.harga) { toast.error('Nama dan harga wajib diisi'); return }
    setSubmitting(true)
    try {
      await sendJSON('/api/ticket', 'POST', {
        ...form,
        nama: form.nama.trim(),
        deskripsi: form.deskripsi.trim() || null,
        harga: Number(form.harga),
        jumlah_orang: Number(form.jumlah_orang) || 1,
        aktif: form.aktif,
        is_hari_h: form.is_hari_h,
        kuota: form.is_hari_h ? Number(form.kuota) || 10 : 0,
        selesai_jual: form.is_hari_h && form.selesai_jual ? new Date(form.selesai_jual).toISOString() : null,
      })
      toast.success('Tipe tiket ditambahkan')
      router.push('/dankelola/ticket/tahap')
    } catch (e) { toast.error(String(e)) } finally { setSubmitting(false) }
  }

  const input = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'
  const label = 'mb-1 block text-xs font-medium text-slate-500'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dankelola/ticket/tahap" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tambah Tipe Tiket</h1>
          <p className="text-sm text-slate-500">Buat tipe tiket baru untuk dijual di halaman publik.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div><label className={label}>Nama Tiket</label><input className={input} value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="Contoh: Reguler" /></div>
          <div><label className={label}>Harga Dasar (Rp)</label><input type="number" min={0} className={input} value={form.harga || ''} onChange={e => setForm({ ...form, harga: Number(e.target.value) })} /></div>
          <div><label className={label}>Berlaku untuk (orang)</label><input type="number" min={1} className={input} value={form.jumlah_orang} onChange={e => setForm({ ...form, jumlah_orang: Number(e.target.value) })} /></div>
        </div>
        <div><label className={label}>Deskripsi</label><textarea className={input} rows={2} value={form.deskripsi} onChange={e => setForm({ ...form, deskripsi: e.target.value })} placeholder="Opsional" /></div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.aktif} onChange={e => setForm({ ...form, aktif: e.target.checked })} /> <span>Buka order</span></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_hari_h} onChange={e => setForm({ ...form, is_hari_h: e.target.checked, kuota: e.target.checked ? form.kuota || 10 : 0 })} /> <span>Tiket Hari H (kuota terbatas)</span></label>
        </div>
        {form.is_hari_h && (
          <div className="grid gap-3 md:grid-cols-2">
            <div><label className={label}>Kuota</label><input type="number" min={1} className={input} value={form.kuota} onChange={e => setForm({ ...form, kuota: Number(e.target.value) })} /></div>
            <div><label className={label}>Tutup Penjualan</label><input type="datetime-local" className={input} value={form.selesai_jual} onChange={e => setForm({ ...form, selesai_jual: e.target.value })} /></div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Link href="/dankelola/ticket/tahap" className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Batal</Link>
          <button onClick={simpan} disabled={submitting} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-xl disabled:opacity-50">{submitting ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  )
}
