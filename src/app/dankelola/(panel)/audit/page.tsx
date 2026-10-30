'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getJSON } from '../../api'
import { TableSkeleton } from '../ui'

type AuditRow = {
  id: string
  aksi: string
  target_type: string | null
  target_id: string | null
  created_at: string
}

export default function AuditPage() {
  const [data, setData] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getJSON<AuditRow[]>('/api/audit').then(setData).catch((e) => toast.error(e.message)).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Audit Log</h1>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr><th className="px-3 py-2">Waktu</th><th className="px-3 py-2">Aksi</th><th className="px-3 py-2">Target</th><th className="px-3 py-2">ID</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {loading && <TableSkeleton rows={6} cols={4} />}
            {!loading && data.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Belum ada aktivitas.</td></tr>}
            {data.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 text-slate-500">{new Date(r.created_at).toLocaleString('id-ID')}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.aksi}</td>
                <td className="px-3 py-2">{r.target_type ?? '-'}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-400">{r.target_id ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
