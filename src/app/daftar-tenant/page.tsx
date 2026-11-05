'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  QrCode,
  Sparkles,
  Store,
  Upload,
  Zap,
} from 'lucide-react'
import { PublicBreadcrumb, PublicNavbar } from '@/components/public-navbar'
import { DataError } from '@/components/data-error'
import { PoStepper } from '@/components/po-stepper'
import { getJSON } from '@/app/dankelola/api'
import {
  periodeDariTanggal,
  type Acara,
  type HargaDasar,
  type KategoriBundleDiscount,
  type KategoriPilihan,
  type KategoriSewa,
  type PeriodeHarga,
} from '@/lib/types'
import { kategoriTenant } from '@/lib/tenant'
import { formatRupiah, todayISO } from '@/lib/utils'

type Katalog = {
  kategori: KategoriSewa[]
  hargaDasar: HargaDasar[]
  periode: PeriodeHarga[]
  pilihan: KategoriPilihan[]
  bundles: KategoriBundleDiscount[]
  acara: Acara | null
  terpakai: Record<string, number>
}

const ALUR = [
  {
    icon: Store,
    title: 'Pilih paket & periode',
    desc: 'Tentukan kategori stand dan periode sewa yang paling sesuai.',
  },
  {
    icon: ClipboardList,
    title: 'Isi form pendaftaran',
    desc: 'Lengkapi data usaha, jumlah tenant, dan pilihan paket.',
  },
  {
    icon: CreditCard,
    title: 'Bayar DP 50%',
    desc: 'Pilih lunas atau nyicil, pembayaran pertama minimal 50%.',
  },
  {
    icon: Upload,
    title: 'Upload bukti bayar',
    desc: 'Kirim bukti transfer agar bisa diverifikasi panitia.',
  },
  {
    icon: QrCode,
    title: 'Terima QR tenant',
    desc: 'QR masuk venue aktif setelah pembayaran mencapai 80%.',
  },
]

const STEP = [{ label: 'Pilih Paket' }, { label: 'Form Pendaftaran' }, { label: 'Pembayaran & QR' }]

export default function InfoTenantPage() {
  const [katalog, setKatalog] = useState<Katalog>({
    kategori: [],
    hargaDasar: [],
    periode: [],
    pilihan: [],
    bundles: [],
    acara: null,
    terpakai: {},
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getJSON<Katalog>('/api/public/tenant/katalog')
      .then((data) => setKatalog({
        kategori: data.kategori || [],
        hargaDasar: data.hargaDasar || [],
        periode: data.periode || [],
        pilihan: data.pilihan || [],
        bundles: data.bundles || [],
        acara: data.acara ?? null,
        terpakai: data.terpakai || {},
      }))
      .catch((e) => {
        console.error('Failed to load tenant info:', e)
        setError('Gagal memuat informasi tenant.')
      })
      .finally(() => setLoading(false))
  }, [])

  const kategori = useMemo(() => kategoriTenant(katalog.kategori), [katalog.kategori])
  const activeKode = periodeDariTanggal(todayISO(), katalog.periode)
  const activePeriod = katalog.periode.find((p) => p.kode === activeKode)

  const hargaMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const h of katalog.hargaDasar) {
      map.set(`${h.kategori_sewa_id}|${h.jenis_usaha}|${h.periode}`, Number(h.harga))
    }
    return map
  }, [katalog.hargaDasar])

  const pilihanMap = useMemo(() => {
    const map = new Map<string, KategoriPilihan[]>()
    for (const p of katalog.pilihan) {
      map.set(p.kategori_sewa_id, [...(map.get(p.kategori_sewa_id) ?? []), p])
    }
    return map
  }, [katalog.pilihan])

  const bundleMap = useMemo(() => {
    const map = new Map<string, KategoriBundleDiscount[]>()
    for (const b of katalog.bundles) {
      map.set(b.kategori_sewa_id, [...(map.get(b.kategori_sewa_id) ?? []), b])
    }
    return map
  }, [katalog.bundles])

  function hargaKategori(kategoriId: string, jenis: 'F&B' | 'Non-F&B') {
    if (!activeKode) return undefined
    const base = hargaMap.get(`${kategoriId}|${jenis}|${activeKode}`)
    if (base === undefined) return undefined
    const pilihanTotal = (pilihanMap.get(kategoriId) ?? []).reduce((sum, p) => sum + Number(p.harga), 0)
    return base + pilihanTotal
  }

  const wrapper = 'mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8'

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f9fc]">
        <PublicNavbar title="Open Tenant" subtitle="In4Days XI · Dana Usaha HMTI" maxWidth="max-w-[1600px]" />
        <main className={wrapper}>
          <div className="mt-8 h-[320px] skeleton rounded-3xl" />
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f7f9fc]">
        <PublicNavbar title="Open Tenant" subtitle="In4Days XI · Dana Usaha HMTI" maxWidth="max-w-[1600px]" />
        <main className={`${wrapper} flex justify-center py-8`}>
          <DataError title={error} />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <PublicNavbar title="Open Tenant" subtitle="In4Days XI · Dana Usaha HMTI" maxWidth="max-w-[1600px]" />

      <main className={`${wrapper} py-6 sm:py-8`}>
        <PublicBreadcrumb
          items={[{ label: 'Beranda', href: '/' }, { label: 'Open Tenant' }]}
          className="mb-5"
        />
        <PoStepper steps={STEP} currentStep={1} />

        <div className="grid items-start gap-8 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600">Alur pendaftaran</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Dari pilih paket sampai QR tenant aktif</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Lima langkah singkat. Pembayaran pertama minimal 50%, QR venue aktif setelah pembayaran mencapai 80%.
            </p>

            <div className="mt-5 space-y-2.5">
              {ALUR.map((item, index) => {
                const Icon = item.icon
                return (
                  <div key={item.title} className="relative flex gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/40">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-slate-300">0{index + 1}</span>
                        <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
            {katalog.acara?.batas_pelunasan && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Batas akhir pembayaran: <span className="font-semibold">{katalog.acara.batas_pelunasan}</span>
              </div>
            )}
          </section>

          <section id="kategori" className="scroll-mt-24">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600">Kategori tenant</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Pilih paket yang paling cocok</h2>
              </div>
              <p className="max-w-md text-sm text-slate-500">
                Harga total sudah termasuk semua pilihan paket. Pilihan bisa disesuaikan di form pendaftaran.
              </p>
            </div>

            {kategori.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                Data kategori tenant belum tersedia.
              </div>
            ) : (
              <div className="space-y-4">
                {kategori.map((k) => {
                  const pilihan = pilihanMap.get(k.id) ?? []
                  const bundles = bundleMap.get(k.id) ?? []
                  const hargaFnb = hargaKategori(k.id, 'F&B')
                  const hargaNonFnb = hargaKategori(k.id, 'Non-F&B')
                  const terpakai = Number(katalog.terpakai[k.id] ?? 0)
                  const sisa = Number(k.slot_tenant) > 0 ? Math.max(0, Number(k.slot_tenant) - terpakai) : null
                  const habis = sisa === 0
                  const periodePaket = katalog.periode.filter((p) =>
                    hargaMap.has(`${k.id}|F&B|${p.kode}`) || hargaMap.has(`${k.id}|Non-F&B|${p.kode}`)
                  )
                  return (
                    <article key={k.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm shadow-slate-200/40 ${habis ? 'border-slate-200 opacity-75' : 'border-slate-200/70'}`}>
                      <div className="grid gap-4 p-5 sm:grid-cols-[180px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_260px]">
                        <div className="h-36 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:h-40">
                          {k.thumbnail_url ? (
                            <img src={k.thumbnail_url} alt={k.nama} className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-slate-400">
                              <Store className="h-8 w-8" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-900">{k.nama}</h3>
                            {sisa !== null && (
                              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${habis ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {habis ? 'Slot habis' : `Sisa ${sisa} slot`}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm leading-relaxed text-slate-600">
                            {k.keterangan || 'Stand sesuai kategori yang dipilih.'}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
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
                          </div>

                          {pilihan.length > 0 && (
                            <p className="mt-2 text-xs text-slate-500">
                              Pilihan: {pilihan.map((p) => p.nama).join(' · ')}
                            </p>
                          )}

                          {periodePaket.length > 0 && (
                            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                              <div className="flex items-center gap-1.5">
                                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Periode harga</p>
                              </div>
                              <div className="mt-2 space-y-1">
                                {periodePaket.map((p) => {
                                  const aktif = p.kode === activeKode
                                  const fnb = hargaMap.get(`${k.id}|F&B|${p.kode}`)
                                  const nonfnb = hargaMap.get(`${k.id}|Non-F&B|${p.kode}`)
                                  return (
                                    <div key={p.id} className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-lg px-2 py-1 text-xs ${aktif ? 'bg-white text-slate-900 shadow-sm ring-1 ring-primary-100' : 'text-slate-500'}`}>
                                      <span className="inline-flex items-center gap-1.5 font-medium">
                                        {p.nama || 'Periode'}
                                        {aktif && <span className="rounded-full bg-primary-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary-700">Aktif</span>}
                                      </span>
                                      <span className="text-[11px] text-slate-400">{p.tanggal_mulai} – {p.tanggal_selesai}</span>
                                      <span className={aktif ? 'font-semibold text-primary-700' : 'font-medium'}>
                                        {fnb !== undefined && <>F&B {formatRupiah(fnb)}</>}
                                        {fnb !== undefined && nonfnb !== undefined && ' · '}
                                        {nonfnb !== undefined && <>Non-F&B {formatRupiah(nonfnb)}</>}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {bundles.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {bundles.map((b) => (
                                <span key={b.id} className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                                  <Sparkles className="h-3 w-3" /> Sewa {b.jumlah_min}+ tenant
                                  {Number(b.diskon_nominal) > 0 && ` hemat ${formatRupiah(Number(b.diskon_nominal))}`}
                                  {Number(b.diskon_persen) > 0 && `${Number(b.diskon_nominal) > 0 ? ' + ' : ' hemat '}${Number(b.diskon_persen)}%`}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-4 xl:border-0 xl:bg-transparent xl:p-0">
                          <div>
                            <p className="text-[11px] text-slate-500">
                              {activePeriod ? `Total semua pilihan · ${activePeriod.nama}` : 'Total semua pilihan'}
                            </p>
                            {hargaFnb !== undefined && (
                              <p className="mt-1 text-lg font-bold text-slate-900">F&B {formatRupiah(hargaFnb)}</p>
                            )}
                            {hargaNonFnb !== undefined && (
                              <p className="text-sm font-semibold text-slate-700">Non-F&B {formatRupiah(hargaNonFnb)}</p>
                            )}
                            {hargaFnb === undefined && hargaNonFnb === undefined && (
                              <p className="mt-1 text-sm text-slate-400">Harga belum diatur</p>
                            )}
                            {!activePeriod && (
                              <p className="mt-1 text-xs text-amber-600">Harga tampil saat periode pendaftaran dibuka.</p>
                            )}
                          </div>

                          {habis ? (
                            <span className="mt-4 inline-flex items-center justify-center rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400">
                              Slot Habis
                            </span>
                          ) : activePeriod && (hargaFnb !== undefined || hargaNonFnb !== undefined) ? (
                            <Link
                              href={`/daftar-tenant/form?kategori=${k.id}`}
                              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
                            >
                              Pilih Kategori Ini
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          ) : (
                            <span className="mt-4 inline-flex cursor-not-allowed items-center justify-center rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400">
                              Belum Dibuka
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
