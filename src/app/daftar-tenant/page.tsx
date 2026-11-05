'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  QrCode,
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
  type Peralatan,
  type PeriodeHarga,
} from '@/lib/types'
import { kategoriTenant } from '@/lib/tenant'
import { formatRupiah, todayISO } from '@/lib/utils'

type Master = {
  kategori: KategoriSewa[]
  hargaDasar: HargaDasar[]
  periode: PeriodeHarga[]
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
  const [peralatan, setPeralatan] = useState<Peralatan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      getJSON<Master>('/api/master'),
      getJSON<Peralatan[]>('/api/peralatan'),
    ])
      .then(([m, p]) => {
        setMaster({
          kategori: m.kategori || [],
          hargaDasar: m.hargaDasar || [],
          periode: m.periode || [],
        })
        setPeralatan(p || [])
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

  const addonTotal = useMemo(
    () => peralatan.reduce((sum, item) => sum + Math.max(0, Number(item.harga_sewa) || 0), 0),
    [peralatan],
  )

  function hargaKategori(kategoriId: string) {
    if (!activeKode) return undefined
    const base = hargaMap.get(`${kategoriId}|F&B|${activeKode}`) ?? hargaMap.get(`${kategoriId}|Non-F&B|${activeKode}`)
    return base === undefined ? undefined : base + addonTotal
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
              Harga di bawah adalah total jika semua item (tempat dan add-on) dipilih.
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
                        {activePeriod ? `Total semua item · ${activePeriod.nama}` : 'Total semua item'}
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
      </main>
    </div>
  )
}
