'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { getJSON, sendJSON } from '../../../api'
import { PageSkeleton } from '../../ui'

type Pesanan = {
  id: string
  no_pesanan: string
  nama_pembeli: string
  kontak: string
  email: string | null
  jumlah: number
  harga_satuan: number
  total: number
  status: string
  bukti_url: string | null
  catatan_admin: string | null
  created_at: string
  tiket_nama: string
}

export default function VerifikasiTiketPage() {
  const [pesanan, setPesanan] = useState<Pesanan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [catatan, setCatatan] = useState('')

  useEffect(() => {
    getJSON<Pesanan[]>('/api/ticket/verification')
      .then(setPesanan)
      .catch((e) => {
        console.error('Failed to load pesanan:', e)
        setError('Gagal memuat data pesanan')
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleVerifikasi(id: string, status: 'lunas' | 'ditolak') {
    if (!id) return
    try {
      await sendJSON('/api/ticket/verification', 'POST', {
        id,
        status,
        catatan_admin: catatan || null,
      })
      toast.success(`Pesanan ${status === 'lunas' ? 'diterima' : 'ditolak'}`)
      setCatatan('')
      setSelectedId(null)
      const res = await getJSON<Pesanan[]>('/api/ticket/verification')
      setPesanan(res)
    } catch (e) { toast.error((e as Error).message) }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Verifikasi Tiket</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  const menunggu = pesanan.filter(p => p.status === 'menunggu_verifikasi').length
  const lunas = pesanan.filter(p => p.status === 'lunas').length
  const ditolak = pesanan.filter(p => p.status === 'ditolak').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Verifikasi Tiket</h1>
        <Link href="/dankelola/ticket/penjualan" className="text-sm text-indigo-600 hover:underline">← Kembali</Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Menunggu</p>
          <p className="text-3xl font-bold text-yellow-600">{menunggu}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Lunas</p>
          <p className="text-3xl font-bold text-green-600">{lunas}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Ditolak</p>
          <p className="text-3xl font-bold text-red-600">{ditolak}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">No. Pesanan</th>
              <th className="px-3 py-2">Pembeli</th>
              <th className="px-3 py-2">Kontak</th>
              <th className="px-3 py-2">Tiket</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Bukti</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {pesanan.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">Belum ada pesanan.</td></tr>}
            {pesanan.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs">{item.no_pesanan}</td>
                <td className="px-3 py-2 font-medium">{item.nama_pembeli}</td>
                <td className="px-3 py-2">{item.kontak}</td>
                <td className="px-3 py-2">{item.tiket_nama}</td>
                <td className="px-3 py-2">{item.jumlah}</td>
                <td className="px-3 py-2 font-medium">{item.total.toLocaleString('id-ID')}</td>
                <td className="px-3 py-2">
                  {item.bukti_url ? (
                    <a href={item.bukti_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline text-xs">Lihat</a>
                  ) : '-'}
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    item.status === 'menunggu_verifikasi' ? 'bg-yellow-100 text-yellow-800' :
                    item.status === 'lunas' ? 'bg-green-100 text-green-800' :
                    item.status === 'ditolak' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {item.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {item.status === 'menunggu_verifikasi' && (
                    <button 
                      onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                      className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                    >
                      Verifikasi
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6">
          <h2 className="font-semibold mb-4">Verifikasi Pesanan Tiket</h2>
          <textarea
            placeholder="Catatan admin (opsional)"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm mb-4"
            value={catatan}
            onChange={e => setCatatan(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleVerifikasi(selectedId, 'lunas')}
              className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-700"
            >
              ✓ Terima & Cetak Tiket
            </button>
            <button
              onClick={() => handleVerifikasi(selectedId, 'ditolak')}
              className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-700"
            >
              ✗ Tolak
            </button>
            <button
              onClick={() => setSelectedId(null)}
              className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-300"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}