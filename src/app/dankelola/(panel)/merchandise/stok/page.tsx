'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'

type StokLog = {
  id: string
  produk: string
  jenis: 'masuk' | 'keluar'
  qty: number
  tanggal: string
  keterangan: string | null
}

export default function StokPage() {
  const [logs, setLogs] = useState<StokLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ produk: '', qty: 1, jenis: 'masuk', keterangan: '' })

  const load = useCallback(async () => {
    const data = await getJSON<StokLog[]>('/api/merchandise/stok')
    setLogs(data)
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => {
        console.error('Failed to load stok:', e)
        setError('Gagal memuat data stok')
      })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  async function tambah() {
    if (!form.produk) {
      toast.error('Nama produk harus diisi')
      return
    }
    try {
      await sendJSON('/api/merchandise/stok', 'POST', form)
      toast.success('Log stok ditambahkan')
      setForm({ produk: '', qty: 1, jenis: 'masuk', keterangan: '' })
      setShowForm(false)
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Produksi & Stok</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  const totalMasuk = logs.filter(l => l.jenis === 'masuk').reduce((s, l) => s + l.qty, 0)
  const totalKeluar = logs.filter(l => l.jenis === 'keluar').reduce((s, l) => s + l.qty, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Produksi & Stok</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium">+ Tambah Log</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Masuk</p>
          <p className="text-3xl font-bold text-green-600">{totalMasuk}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Keluar</p>
          <p className="text-3xl font-bold text-red-600">{totalKeluar}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Selisih</p>
          <p className="text-3xl font-bold text-primary-600">{totalMasuk - totalKeluar}</p>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <h2 className="font-semibold mb-4">Tambah Log Stok</h2>
          <div className="grid md:grid-cols-4 gap-3">
            <input placeholder="Nama Produk" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.produk} onChange={e => setForm({ ...form, produk: e.target.value })} />
            <input type="number" min="1" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.qty} onChange={e => setForm({ ...form, qty: Number(e.target.value) })} />
            <select className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.jenis} onChange={e => setForm({ ...form, jenis: e.target.value as 'masuk' | 'keluar' })}>
              <option value="masuk">Masuk</option>
              <option value="keluar">Keluar</option>
            </select>
            <input placeholder="Keterangan" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.keterangan} onChange={e => setForm({ ...form, keterangan: e.target.value })} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
            <button onClick={tambah} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-xl">Simpan</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Tanggal</th>
              <th className="px-3 py-2">Produk</th>
              <th className="px-3 py-2">Jenis</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Keterangan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {logs.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Belum ada log stok.</td></tr>}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-500">{log.tanggal}</td>
                <td className="px-3 py-2 font-medium">{log.produk}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${log.jenis === 'masuk' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {log.jenis}
                  </span>
                </td>
                <td className="px-3 py-2">{log.qty}</td>
                <td className="px-3 py-2 text-slate-500">{log.keterangan || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}