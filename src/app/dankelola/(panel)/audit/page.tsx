'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { RotateCcw, Search } from 'lucide-react'
import { getJSON } from '../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { parseUserAgent } from '@/lib/request-meta'
import { menuConfig } from '@/lib/menu'
import { TableSkeleton } from '../ui'

type AuditRow = {
  id: string
  aksi: string
  target_type: string | null
  target_id: string | null
  user_name: string | null
  location: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

const control = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10'

function formatWaktu(value: string) {
  return new Date(value).toLocaleString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const PAGE_RULES: Array<[RegExp, string]> = [
  [/^\/dankelola$/, 'Ringkasan'],
  [/^\/dankelola\/scan$/, 'Scan QR'],
  [/^\/dankelola\/tenants\/harga\/new$/, 'Tambah Paket'],
  [/^\/dankelola\/tenants\/harga\/[^/]+\/edit$/, 'Edit Paket'],
  [/^\/dankelola\/tenants\/harga\/[^/]+$/, 'Detail Paket'],
  [/^\/dankelola\/tenants\/pembayaran$/, 'Batas Pembayaran'],
  [/^\/dankelola\/tenants\/[^/]+$/, 'Detail Tenant'],
  [/^\/dankelola\/merchandise\/produk\/new$/, 'Tambah Produk'],
  [/^\/dankelola\/merchandise\/produk\/[^/]+\/edit$/, 'Edit Produk'],
  [/^\/dankelola\/merchandise\/produk\/[^/]+$/, 'Detail Produk'],
  [/^\/dankelola\/ticket\/tipe\/new$/, 'Tambah Tipe'],
  [/^\/dankelola\/ticket\/tipe\/[^/]+\/edit$/, 'Edit Tipe'],
  [/^\/dankelola\/ticket\/tipe\/[^/]+$/, 'Detail Tipe'],
  [/^\/dankelola\/ticket\/periode\/new$/, 'Tambah Periode'],
  [/^\/dankelola\/ticket\/periode\/[^/]+\/edit$/, 'Edit Periode'],
]

function pageLabel(path: string) {
  const exact = menuConfig
    .flatMap((group) => [...(group.href ? [{ href: group.href, label: group.label }] : []), ...(group.children ?? [])])
    .find((item) => item.href === path)
  if (exact) return exact.label
  return PAGE_RULES.find(([pattern]) => pattern.test(path))?.[1] ?? path
}

function targetLabel(row: AuditRow) {
  if (!row.target_type && !row.target_id) return '-'
  if (row.target_type === 'page' && row.target_id) return `${pageLabel(row.target_id)} · ${row.target_id}`
  return row.target_id ? `${row.target_type ?? 'target'} · ${row.target_id}` : row.target_type ?? '-'
}

function deviceLabel(ua: string | null) {
  if (!ua) return '-'
  const parsed = parseUserAgent(ua)
  return `${parsed.browser} · ${parsed.os} (${parsed.device})`
}

export default function AuditPage() {
  const [data, setData] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    setData(await getJSON<AuditRow[]>('/api/audit'))
  }, [])

  useEffect(() => {
    load().catch((e) => toast.error(e.message)).finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  const users = useMemo(
    () => Array.from(new Set(data.map((row) => row.user_name).filter((name): name is string => Boolean(name)))).sort(),
    [data],
  )
  const actions = useMemo(
    () => Array.from(new Set(data.map((row) => row.aksi))).sort(),
    [data],
  )

  const summary = useMemo(() => {
    const map = new Map<string, { total: number; pages: number; last: string }>()
    for (const row of data) {
      const name = row.user_name || 'Tanpa nama'
      const entry = map.get(name) ?? { total: 0, pages: 0, last: row.created_at }
      entry.total += 1
      if (row.aksi === 'BUKA_HALAMAN') entry.pages += 1
      if (new Date(row.created_at).getTime() > new Date(entry.last).getTime()) entry.last = row.created_at
      map.set(name, entry)
    }
    return Array.from(map, ([name, value]) => ({ name, ...value })).sort((a, b) => b.total - a.total)
  }, [data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const start = from ? new Date(`${from}T00:00:00`).getTime() : null
    const end = to ? new Date(`${to}T23:59:59`).getTime() : null
    return data.filter((row) => {
      if (userFilter && row.user_name !== userFilter) return false
      if (actionFilter && row.aksi !== actionFilter) return false
      const time = new Date(row.created_at).getTime()
      if (start !== null && time < start) return false
      if (end !== null && time > end) return false
      if (!q) return true
      return [row.aksi, row.target_type, row.target_id, row.user_name, row.location, row.ip_address, row.user_agent]
        .some((value) => value?.toLowerCase().includes(q))
    })
  }, [actionFilter, data, from, search, to, userFilter])

  function resetFilter() {
    setSearch('')
    setUserFilter('')
    setActionFilter('')
    setFrom('')
    setTo('')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Audit Log</h1>
          <p className="mt-1 text-sm text-slate-500">Semua aktivitas pengguna dashboard beserta lokasi, perangkat, dan IP.</p>
        </div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {filtered.length} dari {data.length} aktivitas
        </span>
      </div>

      {summary.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((item) => {
            const selectable = item.name !== 'Tanpa nama'
            const active = selectable && userFilter === item.name
            return (
              <button
                key={item.name}
                type="button"
                disabled={!selectable}
                onClick={() => setUserFilter(active ? '' : item.name)}
                aria-pressed={active}
                className={`rounded-2xl border p-4 text-left shadow-sm shadow-slate-200/40 transition ${
                  active
                    ? 'border-primary-300 bg-primary-50/60 ring-1 ring-primary-200'
                    : 'border-slate-200/70 bg-white'
                } ${selectable ? 'hover:border-primary-200 hover:bg-primary-50/30' : 'cursor-default'}`}
              >
                <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                <div className="mt-2 flex items-baseline gap-3 text-xs text-slate-500">
                  <span><strong className="text-base font-semibold text-slate-900">{item.total}</strong> aktivitas</span>
                  <span><strong className="text-base font-semibold text-slate-900">{item.pages}</strong> halaman</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Terakhir aktif: {formatWaktu(item.last)}</p>
                {selectable && (
                  <p className="mt-2 text-[11px] font-medium text-primary-600">
                    {active ? 'Menampilkan detail di tabel · klik untuk reset' : 'Klik untuk lihat detail aktivitas'}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="grid gap-2 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm shadow-slate-200/40 sm:grid-cols-2 xl:grid-cols-7">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[11px] font-medium text-slate-500">Cari</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className={`${control} w-full pl-9`}
              placeholder="Cari aksi, user, IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500">Pengguna</span>
          <select className={`${control} w-full`} value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="">Semua pengguna</option>
            {users.map((user) => <option key={user} value={user}>{user}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500">Aksi</span>
          <select className={`${control} w-full`} value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">Semua aksi</option>
            {actions.map((action) => <option key={action} value={action}>{action}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500">Dari tanggal</span>
          <input type="date" className={`${control} w-full`} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500">Sampai tanggal</span>
          <input type="date" className={`${control} w-full`} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div className="flex items-end">
          <button onClick={resetFilter} className="flex h-[38px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2.5">Waktu</th>
              <th className="px-3 py-2.5">Aksi</th>
              <th className="px-3 py-2.5">Target</th>
              <th className="px-3 py-2.5">Nama</th>
              <th className="px-3 py-2.5">Lokasi</th>
              <th className="px-3 py-2.5">Perangkat</th>
              <th className="px-3 py-2.5">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {loading && <TableSkeleton rows={6} cols={7} />}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Belum ada aktivitas yang cocok.</td></tr>
            )}
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/80">
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">{formatWaktu(row.created_at)}</td>
                <td className="px-3 py-2.5"><span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">{row.aksi}</span></td>
                <td className="px-3 py-2.5 text-xs text-slate-600">{targetLabel(row)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-700">{row.user_name ?? '-'}</td>
                <td className="px-3 py-2.5 text-xs text-slate-600">{row.location ?? '-'}</td>
                <td className="px-3 py-2.5 text-xs text-slate-600" title={row.user_agent ?? undefined}>{deviceLabel(row.user_agent)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-500">{row.ip_address ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
