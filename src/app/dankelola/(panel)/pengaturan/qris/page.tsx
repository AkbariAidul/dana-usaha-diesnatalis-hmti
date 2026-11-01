'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'

export default function PengaturanQRISPage() {
  const [form, setForm] = useState({ qris_payload: '', qris_nama_merchant: '', qris_rekening: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  const load = useCallback(async (force = false) => {
    const d = await getJSON<Record<string, string>>('/api/pengaturan/qris')
    if (!force && dirtyRef.current) return
    setForm({ qris_payload: d.qris_payload || '', qris_nama_merchant: d.qris_nama_merchant || '', qris_rekening: d.qris_rekening || '' })
    setDirty(false)
  }, [])

  useEffect(() => {
    load()
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load, 5000, !dirty)

  function update(patch: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...patch }))
    setDirty(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await sendJSON('/api/pengaturan/qris', 'POST', form)
      toast.success('Pengaturan QRIS disimpan')
      setDirty(false)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10'

  if (loading) return <p className="text-slate-500">Memuat...</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pengaturan QRIS</h1>
        <p className="mt-1 text-sm text-slate-500">Isi payload QRIS merchant Himpunan. Nanti dipakai buat QRIS dinamis di halaman pendaftaran publik.</p>
      </div>
      <form onSubmit={submit} className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 space-y-4 max-w-2xl">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nama Merchant</label>
          <input className={input} value={form.qris_nama_merchant} onChange={(e) => update({ qris_nama_merchant: e.target.value })} placeholder="HMTI / Dana Usaha" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Rekening / Info Pembayaran</label>
          <input className={input} value={form.qris_rekening} onChange={(e) => update({ qris_rekening: e.target.value })} placeholder="BNI 123456xxx a.n ..." />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">QRIS Payload (Raw String)</label>
          <textarea className={`${input} min-h-[140px] font-mono text-xs`} value={form.qris_payload} onChange={(e) => update({ qris_payload: e.target.value })} placeholder="000201010212..." />
          <p className="mt-1 text-xs text-slate-400">Kopi paste payload QRIS statis/merchant kamu. Untuk MVP ini cukup disimpan & ditampilkan ke pembeli.</p>
        </div>
        <div className="flex justify-end">
          <button disabled={saving} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</button>
        </div>
      </form>
    </div>
  )
}
