'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { useIsViewer } from '@/lib/dashboard-user'

export default function PengaturanTenantPage() {
  const isViewer = useIsViewer()
  const [form, setForm] = useState({ wa_group_nama: '', wa_group_link: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  const load = useCallback(async (force = false) => {
    const d = await getJSON<Record<string, string>>('/api/pengaturan/tenant')
    if (!force && dirtyRef.current) return
    setForm({ wa_group_nama: d.wa_group_nama || '', wa_group_link: d.wa_group_link || '' })
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
    if (isViewer) return
    const link = form.wa_group_link.trim()
    if (link && !/^https?:\/\//i.test(link)) {
      toast.error('Link grup harus diawali https://')
      return
    }
    setSaving(true)
    try {
      await sendJSON('/api/pengaturan/tenant', 'POST', form)
      toast.success('Pengaturan grup WhatsApp tenant disimpan')
      setDirty(false)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'

  if (loading) return <p className="text-slate-500">Memuat...</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pengaturan Tenant</h1>
        <p className="mt-1 text-sm text-slate-500">Atur grup WhatsApp tenant. Tombol gabung grup muncul di halaman lacak tenant setelah pembayaran mencapai 80%.</p>
      </div>
      <form onSubmit={submit} className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 space-y-4 max-w-2xl">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nama Grup WhatsApp</label>
          <input className={input} value={form.wa_group_nama} disabled={isViewer} onChange={(e) => update({ wa_group_nama: e.target.value })} placeholder="Grup Tenant Dies Natalis HMTI" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Link Undangan Grup</label>
          <input className={input} value={form.wa_group_link} disabled={isViewer} onChange={(e) => update({ wa_group_link: e.target.value })} placeholder="https://chat.whatsapp.com/..." />
          <p className="mt-1 text-xs text-slate-400">Tempel link undangan grup WhatsApp (diawali https://chat.whatsapp.com/).</p>
        </div>
        {!isViewer && (
          <div className="flex justify-end">
            <button disabled={saving} className="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-700 disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</button>
          </div>
        )}
      </form>
    </div>
  )
}
