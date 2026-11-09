'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { useIsViewer } from '@/lib/dashboard-user'
import { formatDate } from '@/lib/utils'

type Form = { tanggal: string; lokasi: string }

export default function PengambilanPage() {
  const isViewer = useIsViewer()
  const [form, setForm] = useState<Form>({ tanggal: '', lokasi: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  const load = useCallback(async (force = false) => {
    const d = await getJSON<Form>('/api/pengaturan/merchandise')
    if (!force && dirtyRef.current) return
    setForm({ tanggal: d.tanggal || '', lokasi: d.lokasi || '' })
    setDirty(false)
  }, [])

  useEffect(() => {
    load()
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load, 5000, !dirty)

  function update(patch: Partial<Form>) {
    setForm((f) => ({ ...f, ...patch }))
    setDirty(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (isViewer) return
    if (!form.tanggal) {
      toast.error('Tanggal pengambilan wajib diisi')
      return
    }
    if (!form.lokasi.trim()) {
      toast.error('Lokasi pengambilan wajib diisi')
      return
    }
    setSaving(true)
    try {
      await sendJSON('/api/pengaturan/merchandise', 'POST', form)
      toast.success('Jadwal pengambilan disimpan')
      setDirty(false)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const h2 = useMemo(() => {
    if (!form.tanggal) return ''
    const d = new Date(`${form.tanggal}T00:00:00`)
    d.setDate(d.getDate() - 2)
    return formatDate(d)
  }, [form.tanggal])

  const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'

  if (loading) return <p className="text-slate-500">Memuat...</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pengaturan Pengambilan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Atur tanggal dan lokasi pengambilan merchandise. Pengingat WA otomatis dikirim H-2 dan pagi hari-H ke grup
          panitia serta nomor pemesan umum.
        </p>
      </div>

      <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Tanggal Pengambilan</label>
          <input
            type="date"
            className={input}
            value={form.tanggal}
            disabled={isViewer}
            onChange={(e) => update({ tanggal: e.target.value })}
          />
          {h2 && <p className="mt-1 text-xs text-slate-400">Pengingat H-2 dikirim: {h2}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Lokasi Pengambilan</label>
          <input
            className={input}
            value={form.lokasi}
            disabled={isViewer}
            onChange={(e) => update({ lokasi: e.target.value })}
            placeholder="Contoh: Aula Kampus / Stand Danus"
          />
        </div>
        {!isViewer && (
          <div className="flex justify-end">
            <button
              disabled={saving}
              className="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
