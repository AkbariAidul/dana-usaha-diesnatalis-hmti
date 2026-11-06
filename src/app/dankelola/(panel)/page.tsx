'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { STATUS_LABEL, periodeDariTanggal, type Tenant, type Pembayaran, type PeriodeHarga } from '@/lib/types'
import { formatRupiah, formatDate } from '@/lib/utils'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { getJSON } from '../api'
import { CardsSkeleton } from './ui'

type PreOrder = { total: number; sudah_dibayar: number; status: string }
type Kasir = { total: number }
type Tiket = { status: string; total: number }

const PIE_COLORS = ['#16a34a', '#f97316', '#eab308', '#3b82f6', '#94a3b8']

export default function RingkasanPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [pembayaran, setPembayaran] = useState<Pembayaran[]>([])
  const [periods, setPeriods] = useState<PeriodeHarga[]>([])
  const [preorders, setPreorders] = useState<PreOrder[]>([])
  const [kasir, setKasir] = useState<Kasir[]>([])
  const [tickets, setTickets] = useState<Tiket[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [t, p, pr, po, k, tk] = await Promise.all([
      getJSON<Tenant[]>('/api/tenants'),
      getJSON<Pembayaran[]>('/api/pembayaran'),
      getJSON<PeriodeHarga[]>('/api/master/periode'),
      getJSON<PreOrder[]>('/api/merchandise/preorder').catch(() => []),
      getJSON<Kasir[]>('/api/merchandise/kasir?limit=1000').catch(() => []),
      getJSON<Tiket[]>('/api/ticket/penjualan').catch(() => []),
    ])
    setTenants(t); setPembayaran(p); setPeriods(pr)
    setPreorders(po); setKasir(k); setTickets(tk)
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  const today = new Date().toISOString().slice(0, 10)
  const periodeAktif = periodeDariTanggal(today, periods)
  const periodeAktifData = periods.find((p) => p.kode === periodeAktif)

  const aktif = tenants.filter((t) => t.status !== 'batal')
  const totalTagihan = aktif.reduce((s, t) => s + t.harga_akhir, 0)
  const totalMasuk = aktif.reduce((s, t) => s + t.sudah_dibayar, 0)

  const poValid = preorders.filter((p) => !['ditolak', 'batal'].includes(p.status))
  const masukPo = poValid.reduce((s, p) => s + Number(p.sudah_dibayar), 0)
  const masukKasir = kasir.reduce((s, k) => s + Number(k.total), 0)
  const tiketValid = tickets.filter((t) => !['ditolak', 'batal'].includes(t.status))
  const masukTiket = tiketValid.filter((t) => t.status === 'lunas').reduce((s, t) => s + Number(t.total), 0)

  const stats = useMemo(() => [
    { label: 'Tenant Aktif', value: String(aktif.length), color: 'text-primary-600' },
    { label: 'Total Tagihan', value: formatRupiah(totalTagihan), color: 'text-slate-900' },
    { label: 'Total Masuk', value: formatRupiah(totalMasuk), color: 'text-green-600' },
    { label: 'Piutang', value: formatRupiah(totalTagihan - totalMasuk), color: 'text-orange-600' },
    { label: 'Lunas', value: String(aktif.filter((t) => t.status === 'lunas').length), color: 'text-green-600' },
    { label: 'Menunggak', value: String(aktif.filter((t) => t.status === 'menunggak').length), color: 'text-red-600' },
    { label: 'Masuk Merchandise', value: formatRupiah(masukPo + masukKasir), color: 'text-violet-600' },
    { label: 'Pendapatan Tiket', value: formatRupiah(masukTiket), color: 'text-sky-600' },
  ], [aktif, totalTagihan, totalMasuk, masukPo, masukKasir, masukTiket])

  const statusData = useMemo(
    () => Object.keys(STATUS_LABEL)
      .map((status) => ({ status, name: STATUS_LABEL[status], value: aktif.filter((t) => t.status === status).length }))
      .filter((item) => item.value > 0),
    [aktif],
  )

  const pemasukanData = useMemo(() => [
    { name: 'Tenant', value: totalMasuk },
    { name: 'Merchandise', value: masukPo + masukKasir },
    { name: 'Tiket', value: masukTiket },
  ].filter((item) => item.value > 0), [totalMasuk, masukPo, masukKasir, masukTiket])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Ringkasan</h1>
        <p className="text-sm text-slate-500">Pantau performa tenant, merchandise, dan ticket Dana Usaha.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary-100 bg-primary-50 px-6 py-3 text-sm">
        <span className="font-semibold text-primary-700">
          {periodeAktifData ? `Periode berjalan: ${periodeAktifData.nama}` : 'Di luar periode open tenant'}
        </span>
        {periodeAktifData && (
          <span className="text-primary-600">{formatDate(periodeAktifData.tanggal_mulai)} – {formatDate(periodeAktifData.tanggal_selesai)}</span>
        )}
        <Link href="/dankelola/tenants" className="ml-auto text-primary-700 font-medium hover:underline">+ Catat tenant</Link>
      </div>

      {loading ? (
        <CardsSkeleton n={8} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/40">
                <p className="text-sm text-slate-500">{s.label}</p>
                <p className={`mt-1 text-xl font-semibold tracking-tight ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/40">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">Sumber pemasukan</h2>
                  <p className="text-xs text-slate-500">Dana yang sudah tercatat masuk.</p>
                </div>
                <Link href="/dankelola/laporan" className="text-sm font-medium text-primary-600 hover:underline">Laporan</Link>
              </div>
              <div className="h-64">
                {pemasukanData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pemasukanData} margin={{ top: 16, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000)}jt`} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(value) => [formatRupiah(Number(value)), 'Masuk']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={80}>
                        {pemasukanData.map((_, i) => <Cell key={i} fill={['#7c3aed', '#8b5cf6', '#0ea5e9'][i]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="grid h-full place-items-center text-sm text-slate-400">Belum ada pemasukan.</p>}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/40">
              <div className="mb-2">
                <h2 className="font-semibold text-slate-900">Status tenant</h2>
                <p className="text-xs text-slate-500">Distribusi {aktif.length} tenant aktif.</p>
              </div>
              <div className="flex h-64 items-center gap-4">
                <div className="h-full min-w-0 flex-1">
                  {statusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={84} paddingAngle={3}>
                          {statusData.map((item, i) => <Cell key={item.status} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value, name) => [`${value} tenant`, String(name)]} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="grid h-full place-items-center text-sm text-slate-400">Belum ada tenant.</p>}
                </div>
                <div className="w-32 shrink-0 space-y-2">
                  {statusData.map((item, i) => (
                    <div key={item.status} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="truncate">{item.name}</span>
                      </span>
                      <span className="font-mono text-slate-500">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Tenant Terbaru</h2>
                <Link href="/dankelola/tenants" className="text-sm text-primary-600">Lihat semua</Link>
              </div>
              <div className="divide-y divide-slate-100/80">
                {tenants.slice(-5).reverse().map((t) => (
                  <Link key={t.id} href={`/dankelola/tenants/${t.id}`} className="flex justify-between py-2 text-sm hover:text-primary-600">
                    <span>{t.kode_stand} · {t.nama_usaha}</span>
                    <span className="text-slate-500">{formatRupiah(t.harga_akhir)}</span>
                  </Link>
                ))}
                {tenants.length === 0 && <p className="py-2 text-sm text-slate-400">Belum ada tenant.</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Pembayaran Terakhir</h2>
                <Link href="/dankelola/tenants" className="text-sm text-primary-600">Lihat semua</Link>
              </div>
              <div className="divide-y divide-slate-100/80">
                {pembayaran.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex justify-between py-2 text-sm">
                    <span>{p.no_transaksi} · {p.tenants?.nama_usaha ?? '-'}</span>
                    <span className="text-green-600">{formatRupiah(p.nominal)}</span>
                  </div>
                ))}
                {pembayaran.length === 0 && <p className="py-2 text-sm text-slate-400">Belum ada pembayaran.</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
