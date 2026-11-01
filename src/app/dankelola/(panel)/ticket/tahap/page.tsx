'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import type { Ticket } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'

export default function TahapPage() {
  const [tiket, setTiket] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nama: '', harga: 0, kuota: 0, deskripsi: '' })

  const load = useCallback(async () => {
    const data = await getJSON<Ticket[]>('/api/ticket')
    setTiket(data)
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => {
        console.error('Failed to load ticket:', e)
        setError('Gagal memuat data tiket')
      })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  async function tambah() {
    if (!form.nama || !form.harga || !form.kuota) {
      toast.error('Nama, harga, dan kuota harus diisi')
      return
    }
    try {
      await fetch('/api/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      toast.success('Tipe tiket ditambahkan')
      setForm({ nama: '', harga: 0, kuota: 0, deskripsi: '' })
      setShowForm(false)
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tahap & Harga</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  const totalKuota = tiket.reduce((s, t) => s + t.kuota, 0)
  const totalTerjual = tiket.reduce((s, t) => s + t.terjual, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tahap & Harga</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium">+ Tambah Tipe</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Kuota</p>
          <p className="text-3xl font-bold text-indigo-600">{totalKuota}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Terjual</p>
          <p className="text-3xl font-bold text-green-600">{totalTerjual}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Sisa</p>
          <p className="text-3xl font-bold text-slate-900">{totalKuota - totalTerjual}</p>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <h2 className="font-semibold mb-4">Tambah Tipe Tiket</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <input placeholder="Nama Tiket" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} />
            <input type="number" placeholder="Harga" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.harga || ''} onChange={e => setForm({ ...form, harga: Number(e.target.value) })} />
            <input type="number" placeholder="Kuota" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.kuota || ''} onChange={e => setForm({ ...form, kuota: Number(e.target.value) })} />
          </div>
          <div className="mt-3">
            <textarea placeholder="Deskripsi (opsional)" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.deskripsi} onChange={e => setForm({ ...form, deskripsi: e.target.value })} rows={2} />
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
              <th className="px-3 py-2">Harga</th>
              <th className="px-3 py-2">Kuota</th>
              <th className="px-3 py-2">Terjual</th>
              <th className="px-3 py-2">Sisa</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {tiket.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Belum ada tipe tiket.</td></tr>}
            {tiket.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{t.nama}</td>
                <td className="px-3 py-2">{formatRupiah(t.harga)}</td>
                <td className="px-3 py-2">{t.kuota}</td>
                <td className="px-3 py-2">{t.terjual}</td>
                <td className="px-3 py-2">{t.kuota - t.terjual}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${t.aktif && t.terjual < t.kuota ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {t.aktif && t.terjual < t.kuota ? 'Aktif' : 'Habis'}
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