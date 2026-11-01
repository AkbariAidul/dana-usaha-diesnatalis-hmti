'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import type { Merchandise } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'

export default function ProdukPage() {
  const [items, setItems] = useState<Merchandise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nama: '', deskripsi: '', harga: 0, stok: 0 })

  const load = useCallback(async () => {
    const data = await getJSON<Merchandise[]>('/api/merchandise')
    setItems(data)
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => {
        console.error('Failed to load merchandise:', e)
        setError('Gagal memuat data produk')
      })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  async function tambah() {
    if (!form.nama || !form.harga) {
      toast.error('Nama dan harga harus diisi')
      return
    }
    try {
      await fetch('/api/merchandise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      toast.success('Produk ditambahkan')
      setForm({ nama: '', deskripsi: '', harga: 0, stok: 0 })
      setShowForm(false)
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Produk & Harga</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  const aktif = items.filter(i => i.aktif).length
  const totalStok = items.reduce((s, i) => s + i.stok, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Produk & Harga</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium">+ Tambah Produk</button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Produk Aktif</p>
          <p className="text-3xl font-bold text-indigo-600">{aktif}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Stok</p>
          <p className="text-3xl font-bold text-slate-900">{totalStok}</p>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <h2 className="font-semibold mb-4">Tambah Produk</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <input placeholder="Nama Produk" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} />
            <input type="number" placeholder="Harga" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.harga || ''} onChange={e => setForm({ ...form, harga: Number(e.target.value) })} />
            <input type="number" placeholder="Stok" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.stok || ''} onChange={e => setForm({ ...form, stok: Number(e.target.value) })} />
            <input placeholder="Deskripsi (opsional)" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.deskripsi} onChange={e => setForm({ ...form, deskripsi: e.target.value })} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
            <button onClick={tambah} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl">Simpan</button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {items.length === 0 && <div className="col-span-2 text-center py-12 text-slate-400">Belum ada produk.</div>}
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{item.nama}</h3>
                {item.deskripsi && <p className="text-sm text-slate-500 mt-1">{item.deskripsi}</p>}
              </div>
              <span className={`px-2 py-0.5 rounded text-xs ${item.aktif ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {item.aktif ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
            <div className="flex justify-between items-center mt-4">
              <span className="font-bold text-xl text-indigo-600">{formatRupiah(item.harga)}</span>
              <span className={`text-sm px-2 py-1 rounded-full ${item.stok > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                Stok: {item.stok}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}