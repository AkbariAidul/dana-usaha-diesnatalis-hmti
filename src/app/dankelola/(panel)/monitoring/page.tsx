'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, Cloud, Database, ExternalLink, HardDrive, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../api'
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
    limit: number
    remaining: number
    percent: number
    buckets: Array<{ name: string; size: number; files: number; error?: string }>
    error?: string
  }
  database: { counts: Record<string, number | null>; total: number }
  vercel: {
    configured: boolean
    dashboardUrl: string
    usageUrl: string
    project: {
      id: string | null
      name: string | null
      framework: string | null
      createdAt: string | null
      nodeVersion: string | null
      rootDirectory: string | null
      buildCommand: string | null
      devCommand: string | null
      installCommand: string | null
      outputDirectory: string | null
    } | null
    latest: VercelDeploymentInfo | null
    recent: Array<VercelDeploymentInfo | null>
    error?: string
  }
  supabase: { projectRef: string | null; dashboardUrl: string }
}

type VercelCommit = {
  provider: string
  branch: string | null
  sha: string | null
  message: string | null
  author: string | null
  authorLogin: string | null
  repo: string | null
  org: string | null
}

type VercelDeploymentInfo = {
  id: string | null
  name: string | null
  state: string
  target: string | null
  url: string | null
  inspectorUrl: string | null
  createdAt: string | null
  buildingAt: string | null
  readyAt: string | null
  durationSeconds: number | null
  readySubstate: string | null
  source: string | null
  aliases: string[]
  regions: string[]
  creator: { username?: string; email?: string } | null
  commit: VercelCommit | null
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

function StorageRing({ percent, used, limit, remaining }: { percent: number; used: number; limit: number; remaining: number }) {
  const safePercent = Math.min(100, Math.max(0, percent))
  const radius = 54
  const circumference = 2 * Math.PI * radius

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" role="img" aria-label={`Storage terpakai ${safePercent.toFixed(1)}%`}>
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="12" />
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={safePercent >= 85 ? '#f97316' : '#7c3aed'}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - safePercent / 100)}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <p className="text-2xl font-bold tracking-tight text-slate-900">{safePercent.toFixed(1)}%</p>
          <p className="text-[11px] text-slate-500">terpakai</p>
        </div>
      </div>
      <div className="min-w-0 space-y-2 text-sm">
        <div>
          <p className="text-xs text-slate-500">Storage terpakai</p>
          <p className="font-semibold text-slate-900">{formatBytes(used)} <span className="font-normal text-slate-400">dari {formatBytes(limit)}</span></p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Sisa storage</p>
          <p className="font-semibold text-emerald-600">{formatBytes(remaining)}</p>
        </div>
      </div>
    </div>
  )
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

function stateClass(state: string) {
  if (state === 'READY') return 'bg-emerald-50 text-emerald-700'
  if (state === 'ERROR') return 'bg-red-50 text-red-700'
  if (state === 'CANCELED') return 'bg-slate-100 text-slate-600'
  return 'bg-amber-50 text-amber-700'
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return null
  if (seconds < 60) return `${seconds} detik`
  return `${Math.floor(seconds / 60)} menit ${seconds % 60} detik`
}

function InfoRow({ label, value, mono = false, href, title }: {
  label: string
  value: string | null | undefined
  mono?: boolean
  href?: string
  title?: string
}) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-slate-500">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="min-w-0 break-all text-right text-xs font-medium text-primary-600 hover:underline" title={title ?? value}>
          {value}
        </a>
      ) : (
        <span className={`min-w-0 break-words text-right text-xs text-slate-700 ${mono ? 'font-mono' : ''}`} title={title ?? value}>{value}</span>
      )}
    </div>
  )
}

function DeploymentDetails({ item }: { item: VercelDeploymentInfo }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Status</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${stateClass(item.state)}`}>{item.state}</span>
      </div>
      <InfoRow label="Target" value={item.target ?? '-'} />
      <InfoRow label="Source" value={item.source ?? '-'} />
      <InfoRow label="Deployment" value={item.name ?? item.id} mono />
      <InfoRow label="URL" value={item.url} href={item.url ?? undefined} />
      <InfoRow label="Inspector" value={item.inspectorUrl ? 'Buka inspector deployment' : null} href={item.inspectorUrl ?? undefined} />
      <InfoRow label="Dibuat" value={item.createdAt ? formatDateTime(item.createdAt) : null} />
      <InfoRow label="Mulai build" value={item.buildingAt ? formatDateTime(item.buildingAt) : null} />
      <InfoRow label="Selesai" value={item.readyAt ? formatDateTime(item.readyAt) : null} />
      <InfoRow label="Durasi" value={formatDuration(item.durationSeconds)} />
      <InfoRow label="Ready substate" value={item.readySubstate} />
      <InfoRow label="Region" value={item.regions.length > 0 ? item.regions.join(', ') : null} />
      <InfoRow label="Alias" value={item.aliases.length > 0 ? item.aliases.join(', ') : null} />
      <InfoRow label="Creator" value={item.creator?.username || item.creator?.email || null} />
      {item.commit && (
        <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Commit {item.commit.provider}</p>
          <InfoRow label="Branch" value={item.commit.branch} mono />
          <InfoRow label="Commit" value={item.commit.sha} mono />
          <InfoRow label="Pesan" value={item.commit.message} />
          <InfoRow label="Author" value={item.commit.author ?? item.commit.authorLogin} />
          <InfoRow label="Repo" value={item.commit.repo} />
          <InfoRow label="Organisasi" value={item.commit.org} />
        </div>
      )}
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

  const [cleaningUp, setCleaningUp] = useState(false)
  async function handleCleanup(bucket: string) {
    setCleaningUp(true)
    try {
      const result = await sendJSON('/api/storage/cleanup', 'POST', { bucket })
      toast.success(`Bersih: ${result.removed} file dihapus, ${result.failed} gagal`)
      await load()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setCleaningUp(false)
    }
  }

  if (loading) return <PageSkeleton />
  if (!data) return <p className="text-sm text-slate-500">Monitoring belum tersedia.</p>

  const { visitors, storage, database, vercel, supabase } = data

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
          <StorageRing percent={storage.percent} used={storage.total} limit={storage.limit} remaining={storage.remaining} />
          <p className="mt-3 text-xs text-slate-500">{storage.files} file tersimpan</p>
          <div className="mt-4 space-y-2">
            {storage.buckets.length === 0 && <p className="text-sm text-slate-400">{storage.error ?? 'Belum ada bucket.'}</p>}
            {storage.buckets.map((bucket) => (
              <div key={bucket.name} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium text-slate-700">{bucket.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{formatBytes(bucket.size)} · {bucket.files} file</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {storage.buckets.map((bucket) => (
              <button
                key={bucket.name}
                type="button"
                onClick={() => handleCleanup(bucket.name)}
                disabled={cleaningUp}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                Bersihkan {bucket.name} ({formatBytes(bucket.size)})
              </button>
            ))}
          </div>
          <a href={supabase.dashboardUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline">
            Buka usage Supabase <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/40 xl:order-1">
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

        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/40 xl:order-2">
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

        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/40 xl:order-3 xl:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Cloud className="h-4 w-4 text-primary-600" />
            <h2 className="font-semibold text-slate-900">Deployment Vercel</h2>
          </div>
          {!vercel.configured && (
            <div className="space-y-3 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Cara mengaktifkan deployment Vercel:</p>
              <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed">
                <li>
                  Buka <a href="https://vercel.com/account/tokens" target="_blank" rel="noreferrer" className="font-medium text-primary-600 hover:underline">Vercel Account Tokens</a>, lalu buat token baru.
                </li>
                <li>Buka project di Vercel → <span className="font-medium">Settings → General</span>, salin <code className="rounded bg-slate-100 px-1 font-mono">Project ID</code>.</li>
                <li>
                  Tambahkan environment variable di <span className="font-medium">Project Settings → Environment Variables</span>:
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-900 p-2.5 text-[11px] leading-relaxed text-slate-100">{`VERCEL_TOKEN=...\nVERCEL_PROJECT_ID=...\nVERCEL_TEAM_ID=... (opsional)`}</pre>
                </li>
                <li>Redeploy project. Untuk lokal, simpan juga di <code className="rounded bg-slate-100 px-1 font-mono">.env.local</code>.</li>
              </ol>
              <p className="text-[11px] text-slate-400">Bandwidth/usage detail tetap dibuka lewat tautan Usage Vercel karena tidak tersedia di endpoint API publik.</p>
            </div>
          )}
          {vercel.configured && !vercel.latest && <p className="text-sm text-slate-500">{vercel.error ?? 'Belum ada data deployment.'}</p>}
          {vercel.latest && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">Deployment terbaru</p>
                  {vercel.project?.name && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">{vercel.project.name}</span>}
                </div>
                <DeploymentDetails item={vercel.latest} />
              </div>
              <div className="space-y-4">
                {vercel.project && (
                  <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project</p>
                    <InfoRow label="Nama" value={vercel.project.name} />
                    <InfoRow label="Framework" value={vercel.project.framework} />
                    <InfoRow label="Node.js" value={vercel.project.nodeVersion} />
                    <InfoRow label="Dibuat" value={vercel.project.createdAt ? formatDateTime(vercel.project.createdAt) : null} />
                    <InfoRow label="Root directory" value={vercel.project.rootDirectory} mono />
                    <InfoRow label="Build command" value={vercel.project.buildCommand} mono />
                    <InfoRow label="Dev command" value={vercel.project.devCommand} mono />
                    <InfoRow label="Install command" value={vercel.project.installCommand} mono />
                    <InfoRow label="Output directory" value={vercel.project.outputDirectory} mono />
                  </div>
                )}
                {vercel.recent.filter(Boolean).length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Deployment sebelumnya</p>
                    <div className="space-y-2">
                      {vercel.recent.filter((item): item is VercelDeploymentInfo => Boolean(item)).map((item) => (
                        <div key={item.id ?? `${item.createdAt}-${item.state}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 text-xs">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-700">{item.commit?.branch ?? item.name ?? item.id ?? '-'}</p>
                            <p className="text-slate-400">{item.createdAt ? formatDateTime(item.createdAt) : '-'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.target && <span className="text-slate-500">{item.target}</span>}
                            <span className={`rounded-full px-2 py-0.5 font-semibold ${stateClass(item.state)}`}>{item.state}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium">
            <a href={vercel.dashboardUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary-600 hover:underline">Dashboard <ExternalLink className="h-3.5 w-3.5" /></a>
            <a href={vercel.usageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary-600 hover:underline">Usage Vercel <ExternalLink className="h-3.5 w-3.5" /></a>
            {vercel.latest?.url && <a href={vercel.latest.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary-600 hover:underline">Buka deployment <ExternalLink className="h-3.5 w-3.5" /></a>}
            {vercel.latest?.inspectorUrl && <a href={vercel.latest.inspectorUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary-600 hover:underline">Inspector <ExternalLink className="h-3.5 w-3.5" /></a>}
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
