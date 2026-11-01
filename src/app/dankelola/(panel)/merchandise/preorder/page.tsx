'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import { formatDate, formatRupiah } from '@/lib/utils'

type Item = {
  id: string
  ukuran: string | null
  qty: number
  subtotal: number
  varian: { nama: string } | null
}

type PreOrder = {
  id: string
  no_po: string
  nama_pemesan: string
  kontak: string
  tipe_pemesan: string
  total: number
  sudah_dibayar: number
  status: string
  bukti_url: string | null
  catatan_admin: string | null
  picked_up_at: string | null
  created_at: string
  pengurus: { nama: string; divisi: string | null } | null
  items: Item[]
}

export default function PreorderPage() {
  const [items, setItems] = useState<PreOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [harga, setHarga] = useState(75000)
  const [savingHarga, setSavingHarga] = useState(false)

  async function load() {
    try {
      const [list, setting] = await Promise.all([
        getJSON<PreOrder[]>('/api/merchandise/preorder'),
        getJSON<{ harga: number }>('/api/pengaturan/po'),
      ])
      setItems(list)
      setHarga(setting.harga)
      setError(null)
    } catch (e) {
      setError('Gagal memuat data pre-order')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useLiveRefresh(load)

  async function updateStatus(id: string, status: string) {
    try {
      await sendJSON('/api/merchandise/preorder', 'PATCH', { id, status })
      toast.success(`Status diubah ke ${status.replace(/_/g, ' ')}`)
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }

  async function simpanHarga() {
    if (!harga || harga < 1) { toast.error('Harga PO minimal 1'); return }
    setSavingHarga(true)
    try {
      await sendJSON('/api/pengaturan/po', 'PATCH', { harga })
      toast.success('Harga PO disimpan')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingHarga(false)
    }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pre-Order</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  const menunggu = items.filter((i) => i.status === 'menunggu_verifikasi').length
  const dp = items.filter((i) => i.status === 'dp_diterima').length
  const lunas = items.filter((i) => i.status === 'lunas').length
  const diambil = items.filter((i) => i.picked_up_at).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pre-Order</h1>
        <div className="flex gap-2">
          <Link href="/dankelola/merchandise/pengurus" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Data Pengurus</Link>
          <Link href="/dankelola/scan" className="rounded-xl bg-primary-600 px-3 py-2 text-sm font-medium text-white">Scan Pickup</Link>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Harga PO per item</label>
          <input type="number" min={1} placeholder="cth: 75000" value={harga || ''} onChange={(e) => setHarga(Number(e.target.value))} className="w-40 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <button onClick={simpanHarga} disabled={savingHarga} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {savingHarga ? 'Menyimpan...' : 'Simpan Harga'}
        </button>
        <p className="text-xs text-slate-400">Berlaku untuk pesanan PO publik berikutnya.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Menunggu</p>
          <p className="text-3xl font-bold text-yellow-600">{menunggu}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">DP Diterima</p>
          <p className="text-3xl font-bold text-blue-600">{dp}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Lunas</p>
          <p className="text-3xl font-bold text-green-600">{lunas}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Sudah Diambil</p>
          <p className="text-3xl font-bold text-violet-600">{diambil}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">No. PO</th>
              <th className="px-3 py-2">Pemesan</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Bukti</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {items.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Belum ada pre-order.</td></tr>}
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs">{item.no_po}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{item.nama_pemesan}</div>
                  <div className="text-xs text-slate-500">{item.tipe_pemesan} · {item.kontak}</div>
                  {item.pengurus && <div className="text-xs text-slate-400">{item.pengurus.divisi || '-'}</div>}
                </td>
                <td className="px-3 py-2">
                  {item.items?.map((i) => (
                    <div key={i.id} className="text-xs">{i.varian?.nama || i.ukuran || 'Item'} × {i.qty}</div>
                  ))}
                </td>
                <td className="px-3 py-2 font-medium">{formatRupiah(Number(item.total))}</td>
                <td className="px-3 py-2">
                  {item.bukti_url ? <a href={item.bukti_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">Lihat</a> : '-'}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${
                    item.status === 'menunggu_verifikasi' ? 'bg-yellow-100 text-yellow-800' :
                    item.status === 'dp_diterima' ? 'bg-blue-100 text-blue-800' :
                    item.status === 'lunas' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {item.status.replace(/_/g, ' ')}
                  </span>
                  {item.picked_up_at && <div className="mt-1 text-xs text-green-700">Diambil {formatDate(item.picked_up_at)}</div>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {item.status === 'menunggu_verifikasi' && (
                      <>
                        <button onClick={() => updateStatus(item.id, 'lunas')} className="rounded bg-green-600 px-2 py-1 text-xs text-white">Lunas</button>
                        <button onClick={() => updateStatus(item.id, 'dp_diterima')} className="rounded bg-blue-600 px-2 py-1 text-xs text-white">DP 25%</button>
                        <button onClick={() => updateStatus(item.id, 'ditolak')} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Tolak</button>
                      </>
                    )}
                    {item.status === 'dp_diterima' && (
                      <button onClick={() => updateStatus(item.id, 'lunas')} className="rounded bg-green-600 px-2 py-1 text-xs text-white">Tandai Lunas</button>
                    )}
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
