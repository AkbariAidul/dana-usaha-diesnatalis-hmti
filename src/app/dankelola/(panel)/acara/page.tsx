'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Acara } from '@/lib/types'
import { getJSON, sendJSON } from '../../api'
import { PageSkeleton } from '../ui'

export default function AcaraPage() {
  const [form, setForm] = useState({ id: '', nama: '', tanggal_acara: '', batas_pelunasan: '', rekening_qris: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getJSON<Acara | null>('/api/acara')
      .then((a) => { if (a) setForm({ id: a.id, nama: a.nama, tanggal_acara: a.tanggal_acara, batas_pelunasan: a.batas_pelunasan, rekening_qris: a.rekening_qris }) })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await sendJSON('/api/acara', 'POST', { ...(form.id ? { id: form.id } : {}), nama: form.nama, tanggal_acara: form.tanggal_acara, batas_pelunasan: form.batas_pelunasan, rekening_qris: form.rekening_qris })
      toast.success('Pengaturan acara disimpan')
    } catch (err) { toast.error((err as Error).message) } finally { setSaving(false) }
  }

  const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 text-sm'
  const label = 'block text-sm font-medium mb-1'

  if (loading) return <PageSkeleton />

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pengaturan Acara</h1>
      <form onSubmit={submit} className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 grid md:grid-cols-2 gap-3">
        <div className="md:col-span-2"><label className={label}>Nama Acara</label><input required className={input} value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} /></div>
        <div><label className={label}>Tanggal Acara (Hari H)</label><input type="date" required className={input} value={form.tanggal_acara} onChange={(e) => setForm({ ...form, tanggal_acara: e.target.value })} /></div>
        <div><label className={label}>Batas Pelunasan</label><input type="date" required className={input} value={form.batas_pelunasan} onChange={(e) => setForm({ ...form, batas_pelunasan: e.target.value })} /></div>
        <div className="md:col-span-2"><label className={label}>Rekening / QRIS</label><input className={input} value={form.rekening_qris} onChange={(e) => setForm({ ...form, rekening_qris: e.target.value })} /></div>
        <div className="md:col-span-2 flex justify-end">
          <button disabled={saving} className="bg-indigo-600 text-white px-6 py-2.5.5 rounded-xl font-medium transition-all hover:bg-indigo-700 hover:shadow-sm hover:shadow-indigo-600/20 text-sm disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </form>
    </div>
  )
}
