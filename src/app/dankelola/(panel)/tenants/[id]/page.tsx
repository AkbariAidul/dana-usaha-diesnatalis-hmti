'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import type { Acara, Tenant, PeriodeHarga } from '@/lib/types'
import { formatRupiah, formatDate, formatDateTime } from '@/lib/utils'
import { STATUS_LABEL, STATUS_COLOR, periodeLabel } from '@/lib/types'
import { getJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [periods, setPeriods] = useState<PeriodeHarga[]>([])
  const [acara, setAcara] = useState<Acara | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [t, pr, ac] = await Promise.all([
      getJSON<Tenant>(`/api/tenants/${id}`),
      getJSON<PeriodeHarga[]>('/api/master/periode'),
      getJSON<Acara | null>('/api/acara'),
    ])
    setTenant(t)
    setPeriods(pr)
    setAcara(ac)
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
  const minimalAwal = Number(tenant.dp_wajib || Math.ceil(tenant.harga_akhir / 2))
  const target80 = Math.ceil(tenant.harga_akhir * 0.8)
  const kurangAwal = Math.max(0, minimalAwal - tenant.sudah_dibayar)
  const kurang80 = Math.max(0, target80 - tenant.sudah_dibayar)

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
    ['Minimal Awal (50%)', formatRupiah(minimalAwal)],
    ['Sudah Dibayar', formatRupiah(tenant.sudah_dibayar)],
    ['Sisa Tagihan', formatRupiah(sisa)],
    ['Batas Pembayaran', acara?.batas_pelunasan ? formatDate(acara.batas_pelunasan) : '-'],
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

          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rincian Harga</p>
            <div className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Sewa Tempat · {tenant.kategori_sewa?.nama ?? '-'}</span>
                <span className="font-medium">{formatRupiah(tenant.base_harga ?? tenant.harga_akhir)}</span>
              </div>
              {tenant.addon && tenant.addon.length > 0 && tenant.addon.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span className="text-slate-500">{item.nama} · {item.qty} unit</span>
                  <span className="font-medium">{formatRupiah(Number(item.subtotal))}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-slate-100 pt-1.5 mt-1.5">
                <span className="font-semibold text-slate-900">Total Tagihan</span>
                <span className="font-bold text-primary-600">{formatRupiah(tenant.harga_akhir)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <h2 className="font-semibold text-slate-900">Pembayaran</h2>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${persen}%` }} />
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Terbayar</span><span className="font-semibold text-emerald-600">{persen}%</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Sudah Dibayar</span><span className="font-medium">{formatRupiah(tenant.sudah_dibayar)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Sisa</span><span className="font-semibold text-orange-600">{formatRupiah(sisa)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Minimal Awal (50%)</span><span className="font-medium">{formatRupiah(minimalAwal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Target QR (80%)</span><span className="font-medium">{formatRupiah(target80)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Batas Pembayaran</span><span className="font-medium">{acara?.batas_pelunasan ? formatDate(acara.batas_pelunasan) : '-'}</span></div>
          </div>

          {sisa <= 0 ? (
            <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              Pembayaran tenant sudah lunas.
            </p>
          ) : (
            <p className={`mt-3 rounded-xl px-3 py-2 text-xs leading-relaxed ${kurang80 > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {kurangAwal > 0
                ? <>Pembayaran awal minimal 50%, kurang <strong>{formatRupiah(kurangAwal)}</strong> lagi.</>
                : kurang80 > 0
                  ? <>QR masuk venue aktif setelah pembayaran mencapai 80%, kurang <strong>{formatRupiah(kurang80)}</strong> lagi.</>
                  : <>Pembayaran sudah mencapai 80%. QR masuk venue sudah aktif untuk persiapan tenant H-1.</>}
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            Pelunasan paling lambat pada batas pembayaran. QR venue dipakai saat persiapan tenant H-1.
          </p>
        </div>
      </div>
    </div>
  )
}
