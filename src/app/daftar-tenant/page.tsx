'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Package,
  QrCode,
  ShieldCheck,
  Store,
  Upload,
  Zap,
} from 'lucide-react'
import { PublicBreadcrumb, PublicNavbar } from '@/components/public-navbar'
import { DataError } from '@/components/data-error'
import { getJSON } from '@/app/dankelola/api'
import {
  periodeDariTanggal,
  type HargaDasar,
  type KategoriSewa,
  type PeriodeHarga,
} from '@/lib/types'
import { kategoriTenant } from '@/lib/tenant'
import { formatDate, formatRupiah, todayISO } from '@/lib/utils'

type Master = {
  kategori: KategoriSewa[]
  hargaDasar: HargaDasar[]
  periode: PeriodeHarga[]
}

type Acara = { nama?: string | null; tanggal_acara?: string | null } | null

const ALUR = [
  {
    icon: Store,
    title: 'Pilih paket & periode',
    desc: 'Tentukan kategori stand dan periode sewa yang paling sesuai.',
  },
  {
    icon: ClipboardList,
    title: 'Isi form pendaftaran',
    desc: 'Lengkapi data usaha, kontak aktif, dan pilihan add-on.',
  },
  {
    icon: CreditCard,
    title: 'Bayar DP 50%',
    desc: 'Scan QRIS untuk mengunci slot tenant kamu.',
  },
  {
    icon: Upload,
    title: 'Upload bukti bayar',
    desc: 'Kirim bukti transfer agar bisa diverifikasi panitia.',
  },
  {
    icon: QrCode,
    title: 'Terima QR tenant',
    desc: 'QR masuk venue aktif setelah pembayaran terverifikasi.',
  },
]

export default function InfoTenantPage() {
  const [master, setMaster] = useState<Master>({
    kategori: [],
    hargaDasar: [],
    periode: [],
  })
  const [acara, setAcara] = useState<Acara>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      getJSON<Master>('/api/master'),
      getJSON<Acara>('/api/acara'),
    ])
      .then(([m, a]) => {
        setMaster({
          kategori: m.kategori || [],
          hargaDasar: m.hargaDasar || [],
          periode: m.periode || [],
        })
        setAcara(a)
      })
      .catch((e) => {
        console.error('Failed to load tenant info:', e)
        setError('Gagal memuat informasi tenant.')
      })
      .finally(() => setLoading(false))
  }, [])

  const kategori = useMemo(() => kategoriTenant(master.kategori), [master.kategori])
  const activeKode = periodeDariTanggal(todayISO(), master.periode)
  const activePeriod = master.periode.find((p) => p.kode === activeKode)

  const hargaMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const h of master.hargaDasar) {
      map.set(`${h.kategori_sewa_id}|${h.jenis_usaha}|${h.periode}`, Number(h.harga))
    }
    return map
  }, [master.hargaDasar])

  function hargaKategori(kategoriId: string) {
    if (!activeKode) return undefined
    return hargaMap.get(`${kategoriId}|F&B|${activeKode}`) ?? hargaMap.get(`${kategoriId}|Non-F&B|${activeKode}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f9fc]">
        <PublicNavbar title="Open Tenant" subtitle="In4Days XI · Dana Usaha HMTI" maxWidth="max-w-6xl" />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="h-[280px] skeleton rounded-3xl" />
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f7f9fc]">
        <PublicNavbar title="Open Tenant" subtitle="In4Days XI · Dana Usaha HMTI" maxWidth="max-w-6xl" />
        <main className="mx-auto flex max-w-6xl justify-center px-4 py-8 sm:px-6">
          <DataError title={error} />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <PublicNavbar title="Open Tenant" subtitle="In4Days XI · Dana Usaha HMTI" maxWidth="max-w-6xl" />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <PublicBreadcrumb
          items={[{ label: 'Beranda', href: '/' }, { label: 'Open Tenant' }]}
          className="mb-5"
        />

        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 via-primary-600 to-purple-800 px-6 py-8 text-white shadow-xl shadow-primary-900/20 sm:px-10 sm:py-12">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-3xl" />

          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
              <span className={`h-2 w-2 rounded-full ${activePeriod ? 'bg-emerald-300' : 'bg-amber-300'}`} />
              {activePeriod ? `Pendaftaran dibuka · ${activePeriod.nama}` : 'Pendaftaran belum dibuka'}
            </span>

            <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Buka stan kamu di In4Days XI
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
              Pilih kategori tenant, lihat total harga sewa langsung, lalu daftar dengan DP 50%.
            </p>

            {acara?.tanggal_acara && (
              <p className="mt-5 inline-flex items-center gap-2 rounded-xl bg-black/15 px-3 py-2 text-sm text-white/90">
                <CalendarDays className="h-4 w-4" />
                {formatDate(acara.tanggal_acara)}
              </p>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {activePeriod ? (
                <Link
                  href="/daftar-tenant/form"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-primary-700 shadow-lg shadow-black/10 transition hover:bg-primary-50"
                >
                  Daftar Tenant
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-white/25 px-5 py-3 text-sm font-semibold text-white/80">
                  Pendaftaran Belum Dibuka
                </span>
              )}
              <a
                href="#kategori"
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Lihat Kategori
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/85">
              <span className="inline-flex items-center gap-2">
                <Package className="h-4 w-4" />
                {kategori.length} kategori tenant
              </span>
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {master.periode.length} periode harga
              </span>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                DP 50% saat daftar
              </span>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Alur Pendaftaran</h2>
            <p className="mt-1 text-sm text-slate-500">Lima langkah dari pilih kategori sampai QR tenant aktif.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {ALUR.map((item, index) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/40">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-50 text-primary-700">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-semibold text-slate-300">0{index + 1}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.desc}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section id="kategori" className="mt-10 scroll-mt-24">
          <div className="mb-4">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Kategori Tenant</h2>
            <p className="mt-1 text-sm text-slate-500">
              Harga sudah total per kategori. Add-on meja/kursi bisa dipilih saat mengisi form.
            </p>
          </div>

          {kategori.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              Data kategori tenant belum tersedia.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {kategori.map((k) => {
                const harga = hargaKategori(k.id)
                return (
                  <div key={k.id} className="flex flex-col rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-mono text-xs font-semibold text-primary-600">{k.kode}</span>
                        <h3 className="mt-1 text-lg font-semibold text-slate-900">{k.nama}</h3>
                      </div>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                        <Store className="h-5 w-5" />
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                      {k.keterangan || 'Stand sesuai kategori yang dipilih.'}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      {k.include_listrik && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                          <Zap className="h-3 w-3" /> Listrik
                        </span>
                      )}
                      {k.include_trashbag && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> Trashbag
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                        Add-on meja/kursi tersedia
                      </span>
                    </div>

                    <div className="mt-auto border-t border-slate-100 pt-4">
                      <p className="text-xs text-slate-500">
                        {activePeriod ? `Total harga sewa · ${activePeriod.nama}` : 'Total harga sewa'}
                      </p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {harga !== undefined ? formatRupiah(harga) : '-'}
                      </p>
                      {!activePeriod && (
                        <p className="mt-1 text-xs text-amber-600">Harga tampil saat periode pendaftaran dibuka.</p>
                      )}
                    </div>

                    {activePeriod ? (
                      <Link
                        href={`/daftar-tenant/form?kategori=${k.id}`}
                        className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
                      >
                        Pilih Kategori Ini
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : (
                      <span className="mt-5 inline-flex cursor-not-allowed items-center justify-center rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400">
                        Belum Dibuka
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="mt-10 rounded-3xl bg-slate-900 px-6 py-8 text-center text-white shadow-xl shadow-slate-900/10 sm:px-10 sm:py-10">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Siap buka stan?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
            {activePeriod
              ? `Pendaftaran periode ${activePeriod.nama} sedang dibuka. Kunci slot kamu sekarang sebelum kuota habis.`
              : 'Pantau halaman ini untuk informasi periode pendaftaran berikutnya.'}
          </p>
          {activePeriod ? (
            <Link
              href="/daftar-tenant/form"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-400"
            >
              Daftar Tenant
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="mt-6 inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-white/10 px-6 py-3 text-sm font-semibold text-white/60">
              Pendaftaran Belum Dibuka
            </span>
          )}
        </section>
      </main>
    </div>
  )
}
