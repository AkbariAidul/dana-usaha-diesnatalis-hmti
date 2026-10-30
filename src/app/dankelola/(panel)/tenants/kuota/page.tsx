'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { PageSkeleton } from '../../ui'

type KuotaItem = {
  id: string
  nama_lokasi: string
  total: number
  terisi: number
  sisa: number
  koordinat: string
}

export default function KuotaPage() {
  const [items, setItems] = useState<KuotaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nama_lokasi: '', total: 5, koordinat: '' })

  useEffect(() => {
    getJSON<KuotaItem[]>('/api/kuota')
      .then(setItems)
      .catch((e) => {
        console.error('Failed to load kuota:', e)
        setError('Gagal memuat data kuota')
      })
      .finally(() => setLoading(false))
  }, [])

  async function tambah() {
    if (!form.nama_lokasi) {
      toast.error('Nama lokasi harus diisi')
      return
    }
    try {
      await sendJSON('/api/kuota', 'POST', form)
      toast.success('Lokasi ditambahkan')
      setForm({ nama_lokasi: '', total: 5, koordinat: '' })
      setShowForm(false)
      const res = await getJSON<KuotaItem[]>('/api/kuota')
      setItems(res)
    } catch (e) { toast.error((e as Error).message) }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Kuota & Denah</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  const totalSlot = items.reduce((s, i) => s + i.total, 0)
  const totalTerisi = items.reduce((s, i) => s + i.terisi, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Kuota & Denah</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium">+ Tambah Lokasi</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Slot</p>
          <p className="text-3xl font-bold text-indigo-600">{totalSlot}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Terisi</p>
          <p className="text-3xl font-bold text-green-600">{totalTerisi}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Kosong</p>
          <p className="text-3xl font-bold text-slate-900">{totalSlot - totalTerisi}</p>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <h2 className="font-semibold mb-4">Tambah Lokasi Stand</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <input placeholder="Nama Lokasi" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.nama_lokasi} onChange={e => setForm({ ...form, nama_lokasi: e.target.value })} />
            <input type="number" min="1" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.total} onChange={e => setForm({ ...form, total: Number(e.target.value) })} />
            <input placeholder="Koordinat (opsional)" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.koordinat} onChange={e => setForm({ ...form, koordinat: e.target.value })} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
            <button onClick={tambah} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl">Simpan</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Lokasi</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Terisi</th>
              <th className="px-3 py-2">Sisa</th>
              <th className="px-3 py-2">Progress</th>
              <th className="px-3 py-2">Koordinat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {items.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Belum ada lokasi.</td></tr>}
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{item.nama_lokasi}</td>
                <td className="px-3 py-2">{item.total}</td>
                <td className="px-3 py-2">{item.terisi}</td>
                <td className="px-3 py-2">{item.sisa}</td>
                <td className="px-3 py-2">
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${Math.round((item.terisi / item.total) * 100)}%` }} />
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-500 text-xs">{item.koordinat || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}