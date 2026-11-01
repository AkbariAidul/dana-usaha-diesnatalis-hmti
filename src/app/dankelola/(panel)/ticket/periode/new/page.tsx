'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { sendJSON } from '../../../../api'
import { getJSON } from '../../../../api'
import { ChevronLeft } from 'lucide-react'
import type { TicketKatalogItem, TicketPeriode } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'

export default function PeriodeCreatePage() {
  const router = useRouter()
  const [tiket, setTiket] = useState<TicketKatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tipeId, setTipeId] = useState('')
  const [nama, setNama] = useState('')
  const [mulai, setMulai] = useState('')
  const [selesai, setSelesai] = useState('')
  const [harga, setHarga] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getJSON<TicketKatalogItem[]>('/api/ticket')
      .then((data) => { setTiket(data as TicketKatalogItem[]); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function simpan() {
    if (!tipeId) { toast.error('Pilih tipe tiket'); return }
    if (!mulai || !selesai) { toast.error('Tanggal wajib diisi'); return }
    if (selesai < mulai) { toast.error('Tanggal selesai harus setelah mulai'); return }
    if (!harga) { toast.error('Harga wajib diisi'); return }
    setSubmitting(true)
    try {
      await sendJSON<TicketPeriode>('/api/ticket/periode', 'POST', {
        tiket_tipe_id: tipeId,
        nama: nama.trim() || null,
        tanggal_mulai: mulai,
        tanggal_selesai: selesai,
        harga,
      })
      toast.success('Periode harga ditambahkan')
      router.push('/dankelola/ticket/tahap')
    } catch (e) { toast.error(String(e)) } finally { setSubmitting(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600" />
      </div>
    )
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
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tambah Periode Harga</h1>
          <p className="text-sm text-slate-500">Buat periode harga untuk salah satu tipe tiket.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-4">
        <div>
          <label className={label}>Tipe Tiket</label>
          <select className={input} value={tipeId} onChange={e => setTipeId(e.target.value)}>
            <option value="">-- Pilih tipe tiket --</option>
            {tiket.map(t => (
              <option key={t.id} value={t.id}>{t.nama} ({formatRupiah(Number(t.harga))})</option>
            ))}
          </select>
        </div>

        <div><label className={label}>Nama Periode (opsional)</label><input className={input} value={nama} onChange={e => setNama(e.target.value)} placeholder="Contoh: Early Bird" /></div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Tanggal Mulai</label><input type="date" className={input} value={mulai} onChange={e => setMulai(e.target.value)} /></div>
          <div><label className={label}>Tanggal Selesai</label><input type="date" className={input} value={selesai} onChange={e => setSelesai(e.target.value)} /></div>
        </div>

        <div><label className={label}>Harga (Rp)</label><input type="number" min={0} className={input} value={harga || ''} onChange={e => setHarga(Number(e.target.value))} /></div>

        <div className="flex justify-end gap-2 pt-2">
          <Link href="/dankelola/ticket/tahap" className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Batal</Link>
          <button onClick={simpan} disabled={submitting} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-xl disabled:opacity-50">{submitting ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  )
}
