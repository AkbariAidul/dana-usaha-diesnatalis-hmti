'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { Tenant, Pembayaran, PeriodeHarga } from '@/lib/types'
import { formatRupiah, formatDate } from '@/lib/utils'
import { periodeDariTanggal } from '@/lib/types'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { getJSON } from '../api'
import { CardsSkeleton } from './ui'

export default function RingkasanPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [pembayaran, setPembayaran] = useState<Pembayaran[]>([])
  const [periods, setPeriods] = useState<PeriodeHarga[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [t, p, pr] = await Promise.all([
      getJSON<Tenant[]>('/api/tenants'),
      getJSON<Pembayaran[]>('/api/pembayaran'),
      getJSON<PeriodeHarga[]>('/api/master/periode'),
    ])
    setTenants(t); setPembayaran(p); setPeriods(pr)
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

  const stats = [
    { label: 'Tenant Aktif', value: String(aktif.length), color: 'text-primary-600' },
    { label: 'Total Tagihan', value: formatRupiah(totalTagihan), color: 'text-slate-900' },
    { label: 'Total Masuk', value: formatRupiah(totalMasuk), color: 'text-green-600' },
    { label: 'Piutang', value: formatRupiah(totalTagihan - totalMasuk), color: 'text-orange-600' },
    { label: 'Lunas', value: String(aktif.filter((t) => t.status === 'lunas').length), color: 'text-green-600' },
    { label: 'Menunggak', value: String(aktif.filter((t) => t.status === 'menunggak').length), color: 'text-red-600' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Ringkasan</h1>
        <p className="text-sm text-slate-500">Rekap Dana Usaha Open Tenant</p>
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
        <CardsSkeleton n={6} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
                <p className="text-sm text-slate-500">{s.label}</p>
                <p className={`text-xl font-semibold tracking-tight ${s.color}`}>{s.value}</p>
              </div>
            ))}
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
