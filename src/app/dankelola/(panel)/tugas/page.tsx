'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getJSON } from '../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { TableSkeleton, PageSkeleton } from '../ui'

type Tugas = {
  id: string
  judul: string
  keterangan: string | null
  tenggat: string | null
  status: 'belum' | 'progress' | 'selesai' | 'dibatalkan'
  assigned_to: string | null
  created_at: string
}

export default function TugasPage() {
  const [daftar, setDaftar] = useState<Tugas[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setDaftar(await getJSON<Tugas[]>('/api/tugas'))
  }, [])

  useEffect(() => {
    load().catch((e) => toast.error(e.message)).finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  if (loading) return <PageSkeleton />

  const grouped = daftar.reduce((acc, t) => {
    const key = t.status
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {} as Record<string, Tugas[]>)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tugas Dana Usaha</h1>

      <div className="grid grid-cols-2 gap-4">
        {['belum', 'progress', 'selesai', 'dibatalkan'].map((status) => (
          <div
            key={status}
            className={`rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 ${status === 'belum' ? 'border-red-500/20' : status === 'progress' ? 'border-yellow-500/20' : status === 'selesai' ? 'border-green-500/20' : 'border-gray-500/20'}`}
          >
            <p className="text-sm text-slate-500">{status === 'belum' ? 'Belum' : status === 'progress' ? 'Progress' : status === 'selesai' ? 'Selesai' : 'Dibatalkan'} ({daftar.filter((t) => t.status === status).length})</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Judul</th>
              <th className="px-3 py-2">Tenggat</th>
              <th className="px-3 py-2">Assigned</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {loading && <TableSkeleton rows={6} cols={4} />}
            {!loading && daftar.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Belum ada tugas.</td></tr>}
            {!loading && daftar.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">{t.judul}</td>
                <td className="px-3 py-2">{t.tenggat ? new Date(t.tenggat).toLocaleDateString('id-ID') : '-'}</td>
                <td className="px-3 py-2">{t.assigned_to || '-'}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${status === 'belum' ? 'bg-red-100 text-red-800' : status === 'progress' ? 'bg-yellow-100 text-yellow-800' : status === 'selesai' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {status === 'belum' ? 'Belum' : status === 'progress' ? 'Progress' : status === 'selesai' ? 'Selesai' : 'Dibatalkan'}
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