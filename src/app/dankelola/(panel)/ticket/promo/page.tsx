'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { PageSkeleton } from '../../ui'

type Promo = {
  id: string
  kode: string
  deskripsi: string
  diskon: number
  kuota: number
  terpakai: number
  aktif: boolean
}

export default function PromoPage() {
  const [promos, setPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ kode: '', deskripsi: '', diskon: 0, kuota: 10 })

  useEffect(() => {
    getJSON<Promo[]>('/api/ticket/promo')
      .then(setPromos)
      .catch((e) => {
        console.error('Failed to load promo:', e)
        setError('Gagal memuat data promo')
      })
      .finally(() => setLoading(false))
  }, [])

  async function tambah() {
    if (!form.kode || !form.deskripsi) {
      toast.error('Kode dan deskripsi harus diisi')
      return
    }
    try {
      await sendJSON('/api/ticket/promo', 'POST', form)
      toast.success('Promo ditambahkan')
      setForm({ kode: '', deskripsi: '', diskon: 0, kuota: 10 })
      setShowForm(false)
      const res = await getJSON<Promo[]>('/api/ticket/promo')
      setPromos(res)
    } catch (e) { toast.error((e as Error).message) }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Promo & Penjual</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  const aktif = promos.filter(p => p.aktif).length
  const totalTerpakai = promos.reduce((s, p) => s + p.terpakai, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Promo & Penjual</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium">+ Tambah Promo</button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Promo Aktif</p>
          <p className="text-3xl font-bold text-indigo-600">{aktif}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Kode Dipakai</p>
          <p className="text-3xl font-bold text-slate-900">{totalTerpakai}</p>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <h2 className="font-semibold mb-4">Tambah Promo</h2>
          <div className="grid md:grid-cols-4 gap-3">
            <input placeholder="Kode Promo" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.kode} onChange={e => setForm({ ...form, kode: e.target.value })} />
            <input placeholder="Deskripsi" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.deskripsi} onChange={e => setForm({ ...form, deskripsi: e.target.value })} />
            <input type="number" min="0" max="100" placeholder="Diskon %" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.diskon} onChange={e => setForm({ ...form, diskon: Number(e.target.value) })} />
            <input type="number" min="1" placeholder="Kuota" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.kuota} onChange={e => setForm({ ...form, kuota: Number(e.target.value) })} />
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
              <th className="px-3 py-2">Kode</th>
              <th className="px-3 py-2">Deskripsi</th>
              <th className="px-3 py-2">Diskon</th>
              <th className="px-3 py-2">Kuota</th>
              <th className="px-3 py-2">Terpakai</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {promos.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Belum ada promo.</td></tr>}
            {promos.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono font-medium">{p.kode}</td>
                <td className="px-3 py-2">{p.deskripsi}</td>
                <td className="px-3 py-2 text-green-600">{p.diskon}%</td>
                <td className="px-3 py-2">{p.kuota}</td>
                <td className="px-3 py-2">{p.terpakai}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${p.aktif ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {p.aktif ? 'Aktif' : 'Nonaktif'}
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