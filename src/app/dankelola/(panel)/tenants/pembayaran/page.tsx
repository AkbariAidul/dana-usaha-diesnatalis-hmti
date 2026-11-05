'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { DataError } from '@/components/data-error'
import { getJSON, sendJSON } from '../../../api'
import { type Acara } from '@/lib/types'
import { PageSkeleton } from '../../ui'

export default function BatasPembayaranPage() {
  const [acara, setAcara] = useState<Acara | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ tanggal_acara: '', batas_pelunasan: '' })

  useEffect(() => {
    getJSON<Acara | null>('/api/acara')
      .then((data) => {
      setAcara(data as Acara)
        setForm({
          tanggal_acara: data?.tanggal_acara ?? '',
          batas_pelunasan: data?.batas_pelunasan ?? '',
        })
      })
      .catch((e) => {
        console.error('Failed to load acara:', e)
        setError('Gagal memuat data acara')
      })
      .finally(() => setLoading(false))
  }, [])

  async function simpan() {
    if (!form.batas_pelunasan) {
      toast.error('Tanggal batas pembayaran wajib diisi')
      return
    }
    setSaving(true)
    try {
      const data = await sendJSON('/api/acara', 'POST', {
        ...(acara?.id ? { id: acara.id } : {}),
        tanggal_acara: form.tanggal_acara,
        batas_pelunasan: form.batas_pelunasan,
      })
      setAcara(data)
      toast.success('Batas pembayaran disimpan')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageSkeleton />
  if (error) return <div className="flex justify-center"><DataError title={error} /></div>

  const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Batas Pembayaran</h1>
        <p className="text-sm text-slate-500">Atur tanggal acara dan batas akhir pelunasan tenant.</p>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Tanggal Acara</label>
          <input type="date" className={input} value={form.tanggal_acara} onChange={(e) => setForm({ ...form, tanggal_acara: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Batas Akhir Pembayaran</label>
          <input type="date" className={input} value={form.batas_pelunasan} onChange={(e) => setForm({ ...form, batas_pelunasan: e.target.value })} />
          <p className="mt-1 text-xs text-slate-400">Tanggal ini tampil di halaman publik dan dipakai sebagai batas pelunasan.</p>
        </div>
        <div className="flex justify-end">
          <button onClick={simpan} disabled={saving} className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
