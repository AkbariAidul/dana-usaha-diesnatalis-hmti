'use client'

import { DataError } from '@/components/data-error'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'

type Pendaftaran = {
  id: string
  kode_pendaftaran: string
  nama_usaha: string
  kontak: string
  email: string | null
  jenis_usaha: string
  asal: string
  lokasi: string
  periode_daftar: string
  harga_akhir: number
  dp_wajib: number
  status: string
  bukti_url: string | null
  catatan_admin: string | null
  created_at: string
}

export default function VerifikasiTenantPage() {
  const [pendaftaran, setPendaftaran] = useState<Pendaftaran[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [catatan, setCatatan] = useState('')

  const load = useCallback(async () => {
    const data = await getJSON<Pendaftaran[]>('/api/public/tenant')
    setPendaftaran(data)
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => {
        console.error('Failed to load pendaftaran:', e)
        setError('Gagal memuat data pendaftaran')
      })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  async function handleVerifikasi(id: string, status: 'dp_diterima' | 'ditolak') {
    if (!id) return
    try {
      await sendJSON(`/api/public/tenant/${id}/verifikasi`, 'POST', {
        status,
        catatan_admin: catatan || null,
      })
      toast.success(`Pendaftaran ${status === 'dp_diterima' ? 'diterima' : 'ditolak'}`)
      setCatatan('')
      setSelectedId(null)
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Verifikasi Tenant</h1>
      <DataError title={error} />
    </div>
  )

  const menunggu = pendaftaran.filter(p => p.status === 'menunggu_verifikasi').length
  const diterima = pendaftaran.filter(p => p.status === 'dp_diterima').length
  const ditolak = pendaftaran.filter(p => p.status === 'ditolak').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Verifikasi Tenant</h1>
        <Link href="/dankelola/tenants" className="text-sm text-primary-600 hover:underline">← Kembali</Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Menunggu</p>
          <p className="text-3xl font-bold text-yellow-600">{menunggu}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Diterima</p>
          <p className="text-3xl font-bold text-green-600">{diterima}</p>
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
              <th className="px-3 py-2">Kode</th>
              <th className="px-3 py-2">Usaha</th>
              <th className="px-3 py-2">Kontak</th>
              <th className="px-3 py-2">Jenis</th>
              <th className="px-3 py-2">Harga</th>
              <th className="px-3 py-2">DP</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Bukti</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {pendaftaran.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">Belum ada pendaftaran.</td></tr>}
            {pendaftaran.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs">{item.kode_pendaftaran}</td>
                <td className="px-3 py-2 font-medium">{item.nama_usaha}</td>
                <td className="px-3 py-2">{item.kontak}</td>
                <td className="px-3 py-2">{item.jenis_usaha}</td>
                <td className="px-3 py-2">{Number(item.harga_akhir).toLocaleString('id-ID')}</td>
                <td className="px-3 py-2">{Number(item.dp_wajib).toLocaleString('id-ID')}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    item.status === 'menunggu_verifikasi' ? 'bg-yellow-100 text-yellow-800' :
                    item.status === 'dp_diterima' ? 'bg-green-100 text-green-800' :
                    item.status === 'ditolak' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {item.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {item.bukti_url ? (
                    <a href={item.bukti_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline text-xs">Lihat</a>
                  ) : '-'}
                </td>
                <td className="px-3 py-2">
                  {item.status === 'menunggu_verifikasi' && (
                    <button 
                      onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                      className="text-xs bg-primary-600 text-white px-2 py-1 rounded hover:bg-primary-700"
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
        <div className="rounded-2xl border border-primary-200 bg-primary-50 p-6">
          <h2 className="font-semibold mb-4">Verifikasi Pendaftaran</h2>
          <textarea
            placeholder="Catatan admin (opsional)"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm mb-4"
            value={catatan}
            onChange={e => setCatatan(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleVerifikasi(selectedId, 'dp_diterima')}
              className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-700"
            >
              ✓ Terima & Buat Tenant
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