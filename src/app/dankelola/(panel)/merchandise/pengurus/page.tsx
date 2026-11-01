'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'

type Pengurus = {
  id: string
  nama: string
  divisi: string | null
  kontak: string | null
  aktif: boolean
}

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10'

export default function PengurusPage() {
  const [items, setItems] = useState<Pengurus[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nama: '', divisi: '', kontak: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      setItems(await getJSON<Pengurus[]>('/api/pengurus'))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useLiveRefresh(load)

  async function tambah() {
    if (!form.nama.trim()) return
    setSaving(true)
    try {
      await sendJSON('/api/pengurus', 'POST', form)
      toast.success('Pengurus ditambahkan')
      setForm({ nama: '', divisi: '', kontak: '' })
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function toggle(item: Pengurus) {
    try {
      await sendJSON(`/api/pengurus/${item.id}`, 'PATCH', { aktif: !item.aktif })
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function hapus(item: Pengurus) {
    if (!confirm(`Hapus ${item.nama}?`)) return
    try {
      await sendJSON(`/api/pengurus/${item.id}`, 'DELETE')
      toast.success('Pengurus dihapus')
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Data Pengurus</h1>
        <p className="text-sm text-slate-500">Daftar nama pengurus untuk pilihan PO merchandise.</p>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">Tambah Pengurus</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input className={input} placeholder="Nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
          <input className={input} placeholder="Divisi (opsional)" value={form.divisi} onChange={(e) => setForm({ ...form, divisi: e.target.value })} />
          <input className={input} placeholder="Kontak (opsional)" value={form.kontak} onChange={(e) => setForm({ ...form, kontak: e.target.value })} />
        </div>
        <button onClick={tambah} disabled={saving || !form.nama.trim()} className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {saving ? 'Menyimpan...' : 'Tambah'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2">Divisi</th>
              <th className="px-3 py-2">Kontak</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Belum ada data pengurus.</td></tr>}
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-2 font-medium">{item.nama}</td>
                <td className="px-3 py-2 text-slate-500">{item.divisi || '-'}</td>
                <td className="px-3 py-2 text-slate-500">{item.kontak || '-'}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${item.aktif ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}`}>
                    {item.aktif ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => toggle(item)} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{item.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
                    <button onClick={() => hapus(item)} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Hapus</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
