'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
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

  function hargaTersedia(kategoriId: string) {
    if (!activeKode) return false
    return hargaMap.has(`${kategoriId}|F&B|${activeKode}`) || hargaMap.has(`${kategoriId}|Non-F&B|${activeKode}`)
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

        <div className="space-y-6">
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600">Alur pendaftaran</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Dari pilih paket sampai QR tenant aktif</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
              Lima langkah singkat. Pembayaran pertama minimal 50%, QR venue aktif setelah pembayaran mencapai 80%.
            </p>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
              {ALUR.map((item, index) => {
                const Icon = item.icon
                return (
                  <div key={item.title} className="relative flex gap-3 rounded-2xl border border-slate-200/70 bg-white p-3.5 shadow-sm shadow-slate-200/40">
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
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Batas akhir pembayaran: <span className="font-semibold">{katalog.acara.batas_pelunasan}</span>
              </div>
            )}
          </section>

          <section id="kategori" className="scroll-mt-24">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600">Kategori tenant</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Pilih paket yang paling cocok</h2>
              </div>
              <p className="max-w-md text-sm text-slate-500">
                Harga final tampil di form pendaftaran sesuai periode berjalan.
              </p>
            </div>

            {kategori.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                Data kategori tenant belum tersedia.
              </div>
            ) : (
              <div className="space-y-2.5">
                {kategori.map((k) => {
                  const pilihan = (pilihanMap.get(k.id) ?? []).filter((p) => !/^tempat\b/i.test(p.nama.trim()))
                  const bundles = bundleMap.get(k.id) ?? []
                  const terpakai = Number(katalog.terpakai[k.id] ?? 0)
                  const sisa = Number(k.slot_tenant) > 0 ? Math.max(0, Number(k.slot_tenant) - terpakai) : null
                  const habis = sisa === 0
                  const bisaDaftar = !!activePeriod && hargaTersedia(k.id)
                  const hargaFnb = activeKode ? hargaMap.get(`${k.id}|F&B|${activeKode}`) : undefined
                  const hargaNonFnb = activeKode ? hargaMap.get(`${k.id}|Non-F&B|${activeKode}`) : undefined
                  return (
                    <article key={k.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm shadow-slate-200/40 ${habis ? 'border-slate-200 opacity-75' : 'border-slate-200/70'}`}>
                      <div className="grid gap-3 p-3.5 sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-center">
                        <div className="aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          {k.thumbnail_url ? (
                            <img src={k.thumbnail_url} alt={k.nama} className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-slate-400">
                              <Store className="h-6 w-6" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="text-base font-semibold text-slate-900">{k.nama}</h3>
                            {sisa !== null && (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${habis ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {habis ? 'Slot habis' : `Sisa ${sisa} slot`}
                              </span>
                            )}
                            {k.include_listrik && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                <Zap className="h-2.5 w-2.5" /> Listrik
                              </span>
                            )}
                            {k.include_trashbag && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                <CheckCircle2 className="h-2.5 w-2.5" /> Trashbag
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                            {k.keterangan || 'Stand sesuai kategori yang dipilih.'}
                          </p>

                          {(hargaFnb !== undefined || hargaNonFnb !== undefined) && (
                            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
                              {hargaFnb !== undefined && (
                                <span className="text-slate-500">F&B <span className="font-semibold text-slate-900">{formatRupiah(hargaFnb)}</span></span>
                              )}
                              {hargaNonFnb !== undefined && (
                                <span className="text-slate-500">Non-F&B <span className="font-semibold text-slate-900">{formatRupiah(hargaNonFnb)}</span></span>
                              )}
                              {activePeriod && <span className="text-[10px] text-slate-400">Harga dasar · {activePeriod.nama}</span>}
                            </div>
                          )}

                          {pilihan.length > 0 && (
                            <p className="mt-1 truncate text-[11px] text-slate-500">
                              Pilihan: {pilihan.map((p) => p.nama).join(' · ')}
                            </p>
                          )}

                          {bundles.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {bundles.map((b) => (
                                <span key={b.id} className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                  <Sparkles className="h-2.5 w-2.5" /> {b.jumlah_min}+ tenant
                                  {Number(b.diskon_nominal) > 0 && ` · ${formatRupiah(Number(b.diskon_nominal))}`}
                                  {Number(b.diskon_persen) > 0 && ` · ${Number(b.diskon_persen)}%`}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="sm:pl-2">
                          {habis ? (
                            <span className="inline-flex w-full items-center justify-center rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-400 sm:w-auto">
                              Slot Habis
                            </span>
                          ) : bisaDaftar ? (
                            <Link
                              href={`/daftar-tenant/form?kategori=${k.id}`}
                              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-700 sm:w-auto"
                            >
                              Pilih
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          ) : (
                            <span className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-400 sm:w-auto">
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
