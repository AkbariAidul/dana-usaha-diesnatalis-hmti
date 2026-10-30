'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getJSON } from '../../../api'
import { PageSkeleton } from '../../ui'

type PreOrder = {
  id: string
  nama_pemesan: string
  kontak: string
  produk: string
  qty: number
  size: string
  total: number
  status: 'menunggu' | 'dikonfirmasi' | 'diproduksi' | 'selesai' | 'dibatalkan'
  catatan: string | null
  created_at: string
}

// Mock data untuk demo
const MOCK_PREORDER: PreOrder[] = [
  { id: '1', nama_pemesan: 'Ahmad Fauzi', kontak: '081234567890', produk: 'Kaos Dies Natalis', qty: 2, size: 'L', total: 150000, status: 'menunggu', catatan: null, created_at: '2026-10-25' },
  { id: '2', nama_pemesan: 'Siti Aminah', kontak: '081234567891', produk: 'Hoodie Dies Natalis', qty: 1, size: 'M', total: 250000, status: 'dikonfirmasi', catatan: null, created_at: '2026-10-24' },
  { id: '3', nama_pemesan: 'Budi Santoso', kontak: '081234567892', produk: 'Kaos Dies Natalis', qty: 3, size: 'XL', total: 225000, status: 'diproduksi', catatan: null, created_at: '2026-10-23' },
]

export default function PreorderPage() {
  const [items, setItems] = useState<PreOrder[]>(MOCK_PREORDER)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Simulasi loading
    setTimeout(() => setLoading(false), 500)
  }, [])

  async function updateStatus(id: string, status: PreOrder['status']) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    toast.success(`Status diubah ke ${status}`)
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

  const menunggu = items.filter(i => i.status === 'menunggu').length
  const dikonfirmasi = items.filter(i => i.status === 'dikonfirmasi').length
  const diproduksi = items.filter(i => i.status === 'diproduksi').length
  const selesai = items.filter(i => i.status === 'selesai').length

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pre-Order</h1>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Menunggu</p>
          <p className="text-3xl font-bold text-yellow-600">{menunggu}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Dikonfirmasi</p>
          <p className="text-3xl font-bold text-blue-600">{dikonfirmasi}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Diproduksi</p>
          <p className="text-3xl font-bold text-purple-600">{diproduksi}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Selesai</p>
          <p className="text-3xl font-bold text-green-600">{selesai}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Pemesan</th>
              <th className="px-3 py-2">Produk</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Ukuran</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {items.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Belum ada pre-order.</td></tr>}
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <div className="font-medium">{item.nama_pemesan}</div>
                  <div className="text-xs text-slate-500">{item.kontak}</div>
                </td>
                <td className="px-3 py-2">{item.produk}</td>
                <td className="px-3 py-2">{item.qty}</td>
                <td className="px-3 py-2">{item.size}</td>
                <td className="px-3 py-2 font-medium">{item.total.toLocaleString('id-ID')}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    item.status === 'menunggu' ? 'bg-yellow-100 text-yellow-800' :
                    item.status === 'dikonfirmasi' ? 'bg-blue-100 text-blue-800' :
                    item.status === 'diproduksi' ? 'bg-purple-100 text-purple-800' :
                    item.status === 'selesai' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {item.status === 'menunggu' && (
                    <button onClick={() => updateStatus(item.id, 'dikonfirmasi')} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">Konfirmasi</button>
                  )}
                  {item.status === 'dikonfirmasi' && (
                    <button onClick={() => updateStatus(item.id, 'diproduksi')} className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700">Proses</button>
                  )}
                  {item.status === 'diproduksi' && (
                    <button onClick={() => updateStatus(item.id, 'selesai')} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">Selesai</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}