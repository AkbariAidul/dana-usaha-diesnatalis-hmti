'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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

type PoItem = {
  id: string
  ukuran: string | null
  qty: number
  merchandise: { nama: string } | null
  varian: { nama: string } | null
}

type PoData = {
  id: string
  status: string
  items: PoItem[]
}

export default function StokPage() {
  const [logs, setLogs] = useState<StokLog[]>([])
  const [poList, setPoList] = useState<PoData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ produk: '', qty: 1, jenis: 'masuk', keterangan: '' })

  const load = useCallback(async () => {
    const [data, po] = await Promise.all([
      getJSON<StokLog[]>('/api/merchandise/stok'),
      getJSON<PoData[]>('/api/merchandise/preorder').catch(() => []),
    ])
    setLogs(data)
    setPoList(Array.isArray(po) ? po : [])
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

  const rekap = useMemo(() => {
    const map = new Map<string, { produk: string; ukuran: string; qty: number; po: Set<string> }>()
    for (const po of poList) {
      if (po.status === 'batal' || po.status === 'ditolak') continue
      for (const item of po.items) {
        const produk = item.merchandise?.nama ?? 'Merchandise'
        const ukuran = item.varian?.nama || item.ukuran || '-'
        const key = `${produk}|${ukuran}`
        const row = map.get(key) ?? { produk, ukuran, qty: 0, po: new Set<string>() }
        row.qty += Number(item.qty)
        row.po.add(po.id)
        map.set(key, row)
      }
    }
    return [...map.values()]
      .map((row) => ({ produk: row.produk, ukuran: row.ukuran, qty: row.qty, jumlahPo: row.po.size }))
      .sort((a, b) => a.produk.localeCompare(b.produk) || a.ukuran.localeCompare(b.ukuran))
  }, [poList])
  const totalPo = poList.filter((po) => po.status !== 'batal' && po.status !== 'ditolak').length
  const totalQtyPo = rekap.reduce((sum, row) => sum + row.qty, 0)

  async function tambah() {
    if (!form.produk || !form.qty || form.qty < 1) {
      toast.error('Nama produk dan qty harus diisi')
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

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Rekap Pre-Order untuk Produksi</h2>
            <p className="text-xs text-slate-500">Total {totalPo} PO · {totalQtyPo} item (tanpa PO batal/ditolak)</p>
          </div>
          <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">Data cetak</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Produk</th>
              <th className="px-3 py-2">Ukuran</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Jumlah PO</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {rekap.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Belum ada item pre-order.</td></tr>}
            {rekap.map((row) => (
              <tr key={`${row.produk}|${row.ukuran}`} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{row.produk}</td>
                <td className="px-3 py-2">{row.ukuran}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{row.qty}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-500">{row.jumlahPo}</td>
              </tr>
            ))}
          </tbody>
          {rekap.length > 0 && (
            <tfoot className="bg-slate-50 font-semibold">
              <tr>
                <td className="px-3 py-2" colSpan={2}>Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{totalQtyPo}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <h2 className="font-semibold mb-4">Tambah Log Stok</h2>
          <div className="grid md:grid-cols-4 gap-3">
            <input placeholder="Nama Produk" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.produk} onChange={e => setForm({ ...form, produk: e.target.value })} />
            <input type="number" min="1" placeholder="Qty" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.qty || ''} onChange={e => setForm({ ...form, qty: Number(e.target.value) })} />
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