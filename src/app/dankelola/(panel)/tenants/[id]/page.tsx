'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import type { Tenant, PeriodeHarga } from '@/lib/types'
import { formatRupiah, formatDate, formatDateTime, todayISO } from '@/lib/utils'
import { STATUS_LABEL, STATUS_COLOR, periodeLabel, hitungHariTersisa, hitungMinimalCicilan, tambahHari } from '@/lib/types'
import { getJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [periods, setPeriods] = useState<PeriodeHarga[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [t, pr] = await Promise.all([
      getJSON<Tenant>(`/api/tenants/${id}`),
      getJSON<PeriodeHarga[]>('/api/master/periode'),
    ])
    setTenant(t)
    setPeriods(pr)
  }, [id])

  useEffect(() => {
    load().catch((e) => toast.error(e.message)).finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  if (loading) return <PageSkeleton />
  if (!tenant) return <p className="text-red-600">Tenant tidak ditemukan.</p>

  const sisa = Math.max(0, tenant.harga_akhir - tenant.sudah_dibayar)
  const persen = tenant.harga_akhir > 0
    ? Math.min(100, Math.round((tenant.sudah_dibayar / tenant.harga_akhir) * 100))
    : 0
  const adaTanggal = Boolean(tenant.tgl_dp && tenant.tgl_acara)
  const hariTersisa = adaTanggal ? hitungHariTersisa(tenant.tgl_acara!, tenant.tgl_dp!) : 0
  const minimal = adaTanggal ? hitungMinimalCicilan(hariTersisa, sisa) : 0
  const hariHSudahTiba = Boolean(tenant.tgl_acara && todayISO() >= tenant.tgl_acara)

  const info: Array<[string, string]> = [
    ['Kode Tenant', tenant.kode_stand],
    ['Kontak', tenant.kontak],
    ['Email', tenant.email ?? '-'],
    ['Kategori', tenant.kategori_sewa?.nama ?? '-'],
    ['Jenis Usaha', tenant.jenis_usaha],
    ['Lokasi', tenant.lokasi],
    ['Jumlah Tenant', String(tenant.jumlah_tenant ?? 1)],
    ['Periode', periodeLabel(tenant.periode_daftar, periods)],
    ['Harga Akhir', formatRupiah(tenant.harga_akhir)],
    ['DP Wajib', formatRupiah(tenant.dp_wajib)],
    ['Sudah Dibayar', formatRupiah(tenant.sudah_dibayar)],
    ['Sisa Tagihan', formatRupiah(sisa)],
    ['Tgl Daftar', formatDate(tenant.tgl_daftar)],
    ['Tgl DP', tenant.tgl_dp ? formatDate(tenant.tgl_dp) : '-'],
    ['Tgl Acara', tenant.tgl_acara ? formatDate(tenant.tgl_acara) : '-'],
    [
      'Check-in Venue',
      tenant.venue_checked_in_at
        ? `${formatDateTime(tenant.venue_checked_in_at)}${tenant.venue_checked_in_by ? ` · oleh ${tenant.venue_checked_in_by}` : ''}`
        : 'Belum check-in',
    ],
  ]

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
        <Link href="/dankelola" className="hover:text-slate-800">Dashboard</Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        <Link href="/dankelola/tenants" className="hover:text-slate-800">Data Tenant</Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        <span className="font-medium text-slate-900">{tenant.nama_usaha}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{tenant.nama_usaha}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[tenant.status]}`}>{STATUS_LABEL[tenant.status] ?? tenant.status}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {tenant.kode_stand} · {tenant.kategori_sewa?.nama ?? '-'} · {tenant.kontak}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 lg:col-span-2">
          <h2 className="font-semibold text-slate-900">Data Tenant</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {info.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-slate-100 pb-1.5">
                <dt className="shrink-0 text-slate-500">{k}</dt>
                <dd className="text-right font-medium text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>

          {tenant.addon && tenant.addon.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Item Disewa</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {tenant.addon.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-800">{item.nama}</span>
                    <span className="shrink-0 text-xs text-slate-500">{item.qty} unit · {formatRupiah(Number(item.subtotal))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <h2 className="font-semibold text-slate-900">Cicilan</h2>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${persen}%` }} />
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Terbayar</span><span className="font-semibold text-emerald-600">{persen}%</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Sudah Dibayar</span><span className="font-medium">{formatRupiah(tenant.sudah_dibayar)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Sisa</span><span className="font-semibold text-orange-600">{formatRupiah(sisa)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Hari Tersisa</span><span className="font-bold">{adaTanggal ? `${hariTersisa} hari` : '-'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Minimal/Hari</span><span className="font-bold text-primary-600">{adaTanggal ? formatRupiah(minimal) : '-'}</span></div>
            {tenant.tgl_dp && (
              <div className="flex justify-between"><span className="text-slate-500">Cicilan Mulai</span><span className="font-medium">{formatDate(tambahHari(tenant.tgl_dp, 1))}</span></div>
            )}
          </div>

          {sisa > 0 && !adaTanggal && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
              Tanggal DP dan/atau tanggal acara belum diisi, jadi minimal cicilan harian belum bisa dihitung.
            </p>
          )}
          {sisa > 0 && adaTanggal && hariHSudahTiba && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-600">
              Hari H sudah tiba, sisa tagihan {formatRupiah(sisa)} belum bisa dicicil harian.
            </p>
          )}
          {sisa <= 0 && (
            <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              Pembayaran tenant sudah lunas.
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            Minimal cicilan = sisa tagihan ÷ hari tersisa (H+1 DP s/d Hari H, dibulatkan ke atas).
          </p>
        </div>
      </div>
    </div>
  )
}
