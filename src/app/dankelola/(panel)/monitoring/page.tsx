'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, Cloud, Database, ExternalLink, HardDrive } from 'lucide-react'
import { toast } from 'sonner'
import { getJSON } from '../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { parseUserAgent } from '@/lib/request-meta'
import { formatDateTime } from '@/lib/utils'
import { PageSkeleton } from '../ui'

type Monitoring = {
  generatedAt: string
  visitors: {
    ready: boolean
    today: number
    last7: number
    last30: number
    unique30: number
    daily: Array<{ date: string; total: number }>
    topPages: Array<{ path: string; total: number }>
    recent: Array<{
      path: string
      visitor_id: string | null
      ip_address: string | null
      user_agent: string | null
      location: string | null
      created_at: string
    }>
    error: string | null
  }
  storage: {
    total: number
    files: number
    buckets: Array<{ name: string; size: number; files: number; error?: string }>
    error?: string
  }
  database: { counts: Record<string, number | null>; total: number }
  vercel: {
    configured: boolean
    dashboardUrl: string
    usageUrl: string
    latest: { id: string | null; state: string; target: string | null; url: string | null; createdAt: string | null } | null
    error?: string
  }
  supabase: { projectRef: string | null; dashboardUrl: string }
}

const TABLE_LABEL: Record<string, string> = {
  tenants: 'Tenant',
  pendaftaran_tenant_pub: 'Pendaftaran publik',
  pembayaran: 'Pembayaran',
  merchandise: 'Produk merchandise',
  merch_po: 'Preorder',
  kasir_transaksi: 'Transaksi kasir',
  pesanan_tiket: 'Pesanan tiket',
  audit_log: 'Audit log',
  public_visitor: 'Kunjungan publik',
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function shortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

function Card({ icon: Icon, label, value, note, color = 'text-primary-600' }: {
  icon: typeof Activity
  label: string
  value: string
  note?: string
  color?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/40">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Icon className={`h-4 w-4 ${color}`} />
        {label}
      </div>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${color}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
    </div>
  )
}

export default function MonitoringPage() {
  const [data, setData] = useState<Monitoring | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setData(await getJSON<Monitoring>('/api/monitoring'))
  }, [])

  useEffect(() => {
    load().catch((e) => toast.error(e.message)).finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load, 60000)

  if (loading) return <PageSkeleton />
  if (!data) return <p className="text-sm text-slate-500">Monitoring belum tersedia.</p>

  const { visitors, storage, database, vercel, supabase } = data
  const latest = vercel.latest

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Monitoring</h1>
          <p className="mt-1 text-sm text-slate-500">Storage, database, deployment, dan kunjungan halaman publik.</p>
        </div>
        <p className="text-xs text-slate-400">Diperbarui {formatDateTime(data.generatedAt)}</p>
      </div>

      {!visitors.ready && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Tabel kunjungan belum tersedia. Jalankan migrasi <code className="font-mono">030_audit_visitor.sql</code> agar analytics publik aktif.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card icon={Activity} label="Pengunjung hari ini" value={String(visitors.today)} color="text-primary-600" />
        <Card icon={Activity} label="7 hari terakhir" value={String(visitors.last7)} color="text-sky-600" />
        <Card icon={Activity} label="30 hari terakhir" value={String(visitors.last30)} color="text-violet-600" />
        <Card icon={Activity} label="Visitor unik 30 hari" value={String(visitors.unique30)} color="text-emerald-600" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/40">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Kunjungan 14 hari</h2>
              <p className="text-xs text-slate-500">Halaman publik yang dibuka visitor.</p>
            </div>
            <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">{visitors.last30} / 30 hari</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visitors.daily} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  labelFormatter={(label) => shortDate(String(label))}
                  formatter={(value) => [`${value} kunjungan`, 'Visitor']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Bar dataKey="total" fill="#7c3aed" radius={[6, 6, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/40">
          <div className="mb-4 flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary-600" />
            <h2 className="font-semibold text-slate-900">Storage Supabase</h2>
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900">{formatBytes(storage.total)}</p>
          <p className="text-xs text-slate-500">{storage.files} file tersimpan</p>
          <div className="mt-4 space-y-2">
            {storage.buckets.length === 0 && <p className="text-sm text-slate-400">{storage.error ?? 'Belum ada bucket.'}</p>}
            {storage.buckets.map((bucket) => (
              <div key={bucket.name} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium text-slate-700">{bucket.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{formatBytes(bucket.size)} · {bucket.files} file</span>
              </div>
            ))}
          </div>
          <a href={supabase.dashboardUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline">
            Buka usage Supabase <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/40">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-4 w-4 text-primary-600" />
            <h2 className="font-semibold text-slate-900">Isi database</h2>
          </div>
          <div className="space-y-2">
            {Object.entries(database.counts).map(([table, count]) => (
              <div key={table} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{TABLE_LABEL[table] ?? table}</span>
                <span className="font-mono text-xs text-slate-500">{count === null ? '-' : count.toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/40">
          <div className="mb-4 flex items-center gap-2">
            <Cloud className="h-4 w-4 text-primary-600" />
            <h2 className="font-semibold text-slate-900">Deployment Vercel</h2>
          </div>
          {!vercel.configured && (
            <p className="text-sm text-slate-500">Set <code className="font-mono text-xs">VERCEL_TOKEN</code> dan <code className="font-mono text-xs">VERCEL_PROJECT_ID</code> untuk melihat deployment terakhir.</p>
          )}
          {vercel.configured && !latest && <p className="text-sm text-slate-500">{vercel.error ?? 'Belum ada data deployment.'}</p>}
          {latest && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Status</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{latest.state}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Target</span>
                <span className="font-medium text-slate-700">{latest.target ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Dibuat</span>
                <span className="text-xs text-slate-500">{latest.createdAt ? formatDateTime(latest.createdAt) : '-'}</span>
              </div>
              {latest.url && <a href={latest.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline">Buka deployment <ExternalLink className="h-3.5 w-3.5" /></a>}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium">
            <a href={vercel.dashboardUrl} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">Dashboard</a>
            <a href={vercel.usageUrl} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">Usage Vercel</a>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/40">
          <h2 className="font-semibold text-slate-900">Halaman terpopuler</h2>
          <p className="mb-3 text-xs text-slate-500">30 hari terakhir.</p>
          <div className="space-y-2">
            {visitors.topPages.length === 0 && <p className="text-sm text-slate-400">Belum ada kunjungan.</p>}
            {visitors.topPages.map((page) => (
              <div key={page.path} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-slate-600">{page.path}</span>
                <span className="shrink-0 font-mono text-xs text-slate-500">{page.total}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Kunjungan terbaru</h2>
          <p className="text-xs text-slate-500">20 aktivitas terakhir di halaman publik.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr><th className="px-5 py-2.5">Waktu</th><th className="px-5 py-2.5">Halaman</th><th className="px-5 py-2.5">Lokasi</th><th className="px-5 py-2.5">Perangkat</th><th className="px-5 py-2.5">IP</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {visitors.recent.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Belum ada kunjungan.</td></tr>}
              {visitors.recent.map((visit, index) => {
                const device = parseUserAgent(visit.user_agent)
                return (
                  <tr key={`${visit.created_at}-${index}`} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-5 py-2.5 text-xs text-slate-500">{formatDateTime(visit.created_at)}</td>
                    <td className="px-5 py-2.5 font-medium text-slate-700">{visit.path}</td>
                    <td className="px-5 py-2.5 text-xs text-slate-500">{visit.location ?? '-'}</td>
                    <td className="px-5 py-2.5 text-xs text-slate-500">{device.browser} · {device.os} ({device.device})</td>
                    <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs text-slate-500">{visit.ip_address ?? '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
