'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { PageSkeleton } from '../../ui'

type Peralatan = {
  id: string
  nama: string
  jenis: string
  jumlah: number
  status: 'tersedia' | 'dipinjam' | 'rusak'
}

export default function PeralatanPage() {
  const [items, setItems] = useState<Peralatan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nama: '', jenis: 'Tenda', jumlah: 1 })

  useEffect(() => {
    getJSON<Peralatan[]>('/api/peralatan')
      .then(setItems)
      .catch((e) => {
        console.error('Failed to load peralatan:', e)
        setError('Gagal memuat data peralatan')
      })
      .finally(() => setLoading(false))
  }, [])

  async function tambah() {
    if (!form.nama) {
      toast.error('Nama peralatan harus diisi')
      return
    }
    try {
      await sendJSON('/api/peralatan', 'POST', form)
      toast.success('Peralatan ditambahkan')
      setForm({ nama: '', jenis: 'Tenda', jumlah: 1 })
      setShowForm(false)
      const res = await getJSON<Peralatan[]>('/api/peralatan')
      setItems(res)
    } catch (e) { toast.error((e as Error).message) }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Peralatan & Modal</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  const tersedia = items.filter(i => i.status === 'tersedia').length
  const dipinjam = items.filter(i => i.status === 'dipinjam').length
  const rusak = items.filter(i => i.status === 'rusak').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Peralatan & Modal</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium">+ Tambah</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Tersedia</p>
          <p className="text-3xl font-bold text-green-600">{tersedia}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Dipinjam</p>
          <p className="text-3xl font-bold text-yellow-600">{dipinjam}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Rusak</p>
          <p className="text-3xl font-bold text-red-600">{rusak}</p>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <h2 className="font-semibold mb-4">Tambah Peralatan</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <input placeholder="Nama" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} />
            <select className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.jenis} onChange={e => setForm({ ...form, jenis: e.target.value })}>
              <option>Tenda</option><option>Meja</option><option>Kursi</option><option>Lilin</option><option>Generator</option><option>Lainnya</option>
            </select>
            <input type="number" min="1" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.jumlah} onChange={e => setForm({ ...form, jumlah: Number(e.target.value) })} />
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
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2">Jenis</th>
              <th className="px-3 py-2">Jumlah</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {items.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Belum ada peralatan.</td></tr>}
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">{item.nama}</td>
                <td className="px-3 py-2">{item.jenis}</td>
                <td className="px-3 py-2">{item.jumlah}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${item.status === 'tersedia' ? 'bg-green-100 text-green-800' : item.status === 'dipinjam' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}