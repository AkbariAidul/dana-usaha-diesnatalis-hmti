'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { PublicNavbar } from '@/components/public-navbar'
import { getJSON, sendJSON } from '@/app/dankelola/api'
import { buatQrisDinamis } from '@/lib/qris'
import { formatRupiah } from '@/lib/utils'
import type { TicketKatalogItem } from '@/lib/types'
import QRCode from 'qrcode'
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Info,
  Loader2,
  QrCode,
  ScanLine,
  Smartphone,
  Sparkles,
  Ticket,
  TicketCheck,
  Upload,
  Wallet,
} from 'lucide-react'

const alur = [
  { icon: Ticket, title: 'Pilih tipe tiket', desc: 'Tentukan tipe dan periode yang sesuai.' },
  { icon: Smartphone, title: 'Isi data pembeli', desc: 'Nama, kontak WA, dan jumlah tiket.' },
  { icon: QrCode, title: 'Bayar via QRIS', desc: 'Scan QRIS lewat e-wallet atau m-banking.' },
  { icon: Upload, title: 'Upload bukti', desc: 'Kirim bukti pembayaran untuk diverifikasi.' },
  { icon: BadgeCheck, title: 'Terima QR tiket', desc: 'QR aktif setelah pembayaran diverifikasi.' },
  { icon: ScanLine, title: 'Scan di hari H', desc: 'Tunjukkan QR ke petugas saat masuk acara.' },
]

const input =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-200/40 outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'

function formatTanggal(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function normalisasiKontak(value: string) {
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('62')) digits = `0${digits.slice(2)}`
  else if (digits.startsWith('8')) digits = `0${digits}`
  return digits.slice(0, 13)
}

function LangkahCard({ item, index }: { item: (typeof alur)[number]; index: number }) {
  const Icon = item.icon
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm shadow-slate-200/40 transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lg hover:shadow-primary-600/5">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600 transition group-hover:bg-primary-600 group-hover:text-white">
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Langkah {index + 1}</p>
      </div>
      <p className="mt-2 text-xs font-semibold leading-snug text-slate-900">{item.title}</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{item.desc}</p>
    </div>
  )
}

function statusTiket(t: TicketKatalogItem) {
  if (t.buka) return t.is_hari_h ? 'Hari H' : 'Dibuka'
  if (t.sisa === 0) return 'Habis'
  if (!t.aktif) return 'Belum Dibuka'
  return 'Ditutup'
}

export default function BeliTiketPublik() {
  const [katalog, setKatalog] = useState<{ tiket: TicketKatalogItem[]; varian: Array<Record<string, unknown>> }>({
    tiket: [],
    varian: [],
  })
  const [qris, setQris] = useState<Record<string, string>>({})
  const [form, setForm] = useState({ tiket_tipe_id: '', nama_pembeli: '', kontak: '', email: '', jumlah: 1 })
  const [pesanan, setPesanan] = useState<{
    id: string
    no_pesanan?: string
    nama_pembeli?: string
    jumlah?: number
    total?: number
    t?: string
  } | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [qr, setQr] = useState('')
  const [step, setStep] = useState(1)
  const nominalBayar = Number(pesanan?.total || 0)

  useEffect(() => {
    Promise.all([
      getJSON<{ tiket: TicketKatalogItem[]; varian: Array<Record<string, unknown>> }>('/api/public/katalog'),
      getJSON<Record<string, string>>('/api/pengaturan/qris'),
    ]).then(([k, q]) => {
      setKatalog({ tiket: k.tiket || [], varian: k.varian || [] })
      setQris(q)
    })
  }, [])

  useEffect(() => {
    if (!qris.qris_payload || nominalBayar <= 0) return
    QRCode.toDataURL(buatQrisDinamis(qris.qris_payload, nominalBayar), {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'H',
    })
      .then(setQr)
      .catch(() => {})
  }, [qris, nominalBayar])

  useEffect(() => {
    if (!file) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const tipe = katalog.tiket.find((t) => t.id === form.tiket_tipe_id)
  const bundle = tipe ? tipe.bundle_discounts.find((b) => Number(form.jumlah) === Number(b.jumlah_min)) : null
  const diskon = bundle ? Number(bundle.diskon_persen) : 0
  const subtotal = tipe ? Number(tipe.harga_aktif) * Number(form.jumlah) : 0
  const total = Math.round(subtotal * (1 - diskon / 100))

  function pilihTipe(t: TicketKatalogItem) {
    if (!t.buka) return
    setForm((prev) => ({ ...prev, tiket_tipe_id: t.id }))
    window.setTimeout(() => {
      document.getElementById('form-pembeli')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  async function beli() {
    if (!tipe) {
      toast.error('Pilih tipe tiket')
      return
    }
    if (!tipe.buka) {
      toast.error('Tiket sedang ditutup atau sudah habis')
      return
    }
    if (!/^08\d{8,12}$/.test(form.kontak)) {
      toast.error('Kontak WA harus diawali 08 dan hanya berisi angka')
      return
    }
    if (!form.jumlah || Number(form.jumlah) < 1) {
      toast.error('Jumlah tiket minimal 1')
      return
    }
    if (tipe.sisa !== null && Number(form.jumlah) > tipe.sisa) {
      toast.error(`Sisa tiket ${tipe.sisa}`)
      return
    }
    try {
      const res = await sendJSON('/api/public/tiket', 'POST', {
        ...form,
        jumlah: Math.max(1, Number(form.jumlah) || 1),
      })
      setPesanan(
        res as {
          id: string
          no_pesanan?: string
          nama_pembeli?: string
          jumlah?: number
          total?: number
          t?: string
        }
      )
      setStep(2)
      toast.success('Pesanan dibuat, silakan bayar')
    } catch (e: unknown) {
      toast.error((e as Error).message)
    }
  }

  async function upload() {
    if (!file || !pesanan) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'bukti-tiket')
      const up = await fetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json())
      if (!up.url) throw new Error(up.error || 'Gagal upload bukti')
      await sendJSON(`/api/public/tiket/${pesanan.id}/bukti`, 'POST', { bukti_url: up.url })
      toast.success('Bukti terkirim, menunggu verifikasi')
      setStep(3)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f5f3ff,transparent_38%),radial-gradient(circle_at_top_right,#ecfeff,transparent_32%),#f8fafc]">
      <PublicNavbar
        title="Beli Tiket"
        crumbs={[
          { label: 'Beranda', href: '/' },
          { label: 'Beli Tiket' },
        ]}
        maxWidth="max-w-[1600px]"
      />

      <main className="mx-auto max-w-[1600px] px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        {step === 1 && (
          <>
            <div className="grid items-start gap-8 lg:grid-cols-[400px_minmax(0,1fr)] xl:grid-cols-[460px_minmax(0,1fr)]">
            <section className="lg:sticky lg:top-24 lg:self-start">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600">Alur pembelian</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                  Dari pilih tiket sampai scan di hari H
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Enam langkah singkat. QR tiket baru aktif setelah pembayaran diverifikasi admin.
                </p>
              </div>

              <div className="mt-5 space-y-2.5">
                {[0, 2, 4].map((start) => (
                  <div
                    key={start}
                    className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-1.5"
                  >
                    <LangkahCard item={alur[start]} index={start} />
                    <div className="flex items-center justify-center text-primary-300">
                      <span className="h-px w-2.5 bg-primary-200" />
                      <ArrowRight className="-ml-1 h-4 w-4" />
                    </div>
                    <LangkahCard item={alur[start + 1]} index={start + 1} />
                  </div>
                ))}
              </div>
            </section>

            <section id="tipe-tiket" className="scroll-mt-24">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600">Tipe & periode</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Pilih tiket yang paling cocok</h2>
                </div>
                <p className="max-w-md text-sm text-slate-500">
                  Harga bisa berubah sesuai periode. Periode aktif ditandai dan otomatis dipakai saat checkout.
                </p>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {katalog.tiket.map((t) => {
                  const periods = t.periode ?? []
                  const habis = t.sisa === 0
                  const selected = form.tiket_tipe_id === t.id
                  const terpakai = t.kuota > 0 ? Math.max(0, t.kuota - Number(t.sisa ?? 0)) : 0
                  const pct = t.kuota > 0 ? Math.min(100, Math.round((terpakai / t.kuota) * 100)) : 0
                  return (
                    <article
                      key={t.id}
                      className={`relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition-all ${
                        selected
                          ? 'border-primary-400 ring-2 ring-primary-500/15 shadow-lg shadow-primary-600/10'
                          : 'border-slate-200/70 hover:border-primary-200 hover:shadow-lg hover:shadow-slate-200/50'
                      } ${!t.buka ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        {t.thumbnail_url ? (
                          <div className="h-28 w-[90px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                            <img src={t.thumbnail_url} alt={t.nama} className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="grid h-28 w-[90px] shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-300">
                            <Ticket className="h-7 w-7" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-950">{t.nama}</h3>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                                t.buka
                                  ? t.is_hari_h
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {statusTiket(t)}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-600">
                              {t.jumlah_orang} orang
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">
                            {t.deskripsi || 'Tiket masuk In4Days XI.'}
                          </p>
                          <div className="mt-2.5 flex items-end justify-between gap-3">
                            <div>
                              <p className="text-[11px] text-slate-400">Harga periode aktif</p>
                              <p className="text-lg font-semibold text-primary-600">{formatRupiah(t.harga_aktif)}</p>
                              {t.periode_aktif && Number(t.periode_aktif.harga) !== Number(t.harga) && (
                                <p className="text-xs text-slate-400 line-through">{formatRupiah(t.harga)}</p>
                              )}
                            </div>
                            {t.is_hari_h && t.sisa !== null && (
                              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-medium text-orange-700">
                                Sisa {t.sisa}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {periods.length > 0 && (
                        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                          <div className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Periode harga</p>
                          </div>
                          <div className="mt-2 space-y-1.5">
                            {periods.map((p) => {
                              const aktif = t.periode_aktif?.id === p.id
                              return (
                                <div
                                  key={p.id}
                                  className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-lg px-2 py-1 text-xs ${
                                    aktif ? 'bg-white text-slate-900 shadow-sm ring-1 ring-primary-100' : 'text-slate-500'
                                  }`}
                                >
                                  <span className="inline-flex items-center gap-1.5 font-medium">
                                    {p.nama || 'Periode'}
                                    {aktif && (
                                      <span className="rounded-full bg-primary-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary-700">
                                        Aktif
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    {formatTanggal(p.tanggal_mulai)} – {formatTanggal(p.tanggal_selesai)}
                                  </span>
                                  <span className={aktif ? 'font-semibold text-primary-700' : 'font-medium'}>
                                    {formatRupiah(p.harga)}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          {t.bundle_discounts.map((b) => (
                            <span
                              key={b.id}
                              className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700"
                            >
                              <Sparkles className="h-3 w-3" /> Beli {b.jumlah_min} hemat {b.diskon_persen}%
                            </span>
                          ))}
                          {t.kuota > 0 && (
                            <div className="min-w-[140px] flex-1">
                              <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                                <span>
                                  {terpakai}/{t.kuota} terjual
                                </span>
                                <span>{pct}%</span>
                              </div>
                              <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full rounded-full transition-all ${habis ? 'bg-rose-400' : 'bg-primary-500'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={!t.buka}
                          onClick={() => pilihTipe(t)}
                          className={`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                            selected
                              ? 'bg-primary-600 text-white hover:bg-primary-700'
                              : 'border border-slate-200 bg-white text-slate-700 hover:border-primary-200 hover:text-primary-700'
                          } disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-400`}
                        >
                          {selected ? (
                            <>
                              <CheckCircle2 className="h-4 w-4" /> Tipe dipilih
                            </>
                          ) : t.buka ? (
                            <>
                              Pilih tipe ini <ArrowRight className="h-4 w-4" />
                            </>
                          ) : (
                            'Tidak tersedia'
                          )}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>

              {katalog.tiket.length === 0 && (
                <div className="mt-5 rounded-3xl border border-dashed border-slate-200 bg-white/70 p-10 text-center">
                  <Ticket className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-700">Belum ada tiket yang dibuka.</p>
                  <p className="mt-1 text-sm text-slate-400">Cek lagi nanti atau hubungi panitia.</p>
                </div>
              )}
            </section>
            </div>

            {tipe && (
              <section id="form-pembeli" className="mt-10 scroll-mt-24">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
                  <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600">Data pembeli</p>
                        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Lengkapi data pemesanan</h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Pastikan kontak aktif. Link QR dan status pesanan akan dicek lewat halaman Lacak Pesanan.
                        </p>
                      </div>
                      <span className="hidden shrink-0 rounded-full bg-slate-100 p-2 text-slate-400 sm:grid">
                        <TicketCheck className="h-5 w-5" />
                      </span>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Nama Pembeli</label>
                        <input
                          className={input}
                          placeholder="Nama lengkap"
                          value={form.nama_pembeli}
                          onChange={(e) => setForm({ ...form, nama_pembeli: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Kontak WA</label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel"
                          maxLength={13}
                          pattern="08[0-9]*"
                          className={input}
                          placeholder="08xxxxxxxxxx"
                          value={form.kontak}
                          onChange={(e) => setForm({ ...form, kontak: normalisasiKontak(e.target.value) })}
                        />
                        <p className="mt-1 text-xs text-slate-400">Diawali 08, hanya angka.</p>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Email (opsional)</label>
                        <input
                          className={input}
                          placeholder="nama@email.com"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Jumlah Tiket</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={5}
                          className={input}
                          placeholder="1"
                          value={form.jumlah || ''}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
                            setForm({ ...form, jumlah: digits === '' ? 0 : Number(digits) })
                          }}
                        />
                        <p className="mt-1 text-xs text-slate-400">
                          Berlaku untuk {Number(form.jumlah) * Number(tipe.jumlah_orang)} orang.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-primary-100 bg-primary-50/70 p-3.5 text-primary-800">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      <p className="text-xs leading-relaxed">
                        Satu QR tiket berlaku untuk {tipe.jumlah_orang} orang. Simpan nomor pesanan setelah checkout
                        untuk mengecek status pembayaran dan membuka QR.
                      </p>
                    </div>
                  </div>

                  <aside className="lg:sticky lg:top-24 lg:self-start">
                    <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
                      <div className="border-b border-slate-100 px-5 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Ringkasan</p>
                        <h3 className="mt-0.5 text-base font-semibold text-slate-950">Pesanan kamu</h3>
                      </div>
                      <div className="space-y-4 p-5">
                        <div className="flex gap-3">
                          {tipe.thumbnail_url ? (
                            <div className="h-16 w-[52px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                              <img src={tipe.thumbnail_url} alt={tipe.nama} className="h-full w-full object-cover" />
                            </div>
                          ) : (
                            <div className="grid h-16 w-[52px] shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-300">
                              <Ticket className="h-5 w-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">{tipe.nama}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {tipe.jumlah_orang} orang · {form.jumlah} tiket
                            </p>
                            {tipe.periode_aktif && (
                              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary-600">
                                <CalendarDays className="h-3 w-3" /> {tipe.periode_aktif.nama || 'Periode aktif'}
                              </p>
                            )}
                          </div>
                        </div>

                        <dl className="space-y-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-slate-500">Harga satuan</dt>
                            <dd className="font-medium text-slate-900">{formatRupiah(tipe.harga_aktif)}</dd>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-slate-500">Jumlah</dt>
                            <dd className="font-medium text-slate-900">x{form.jumlah || 0}</dd>
                          </div>
                          {diskon > 0 && (
                            <div className="flex items-center justify-between gap-3 text-emerald-600">
                              <dt>Diskon bundle</dt>
                              <dd className="font-medium">-{diskon}%</dd>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                            <dt className="font-semibold text-slate-900">Total</dt>
                            <dd className="text-lg font-semibold text-primary-600">{formatRupiah(total)}</dd>
                          </div>
                        </dl>

                        <button
                          type="button"
                          onClick={beli}
                          disabled={!form.nama_pembeli || !form.kontak || !form.jumlah || !tipe.buka}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-600/20 transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                        >
                          {tipe.buka ? 'Buat Pesanan' : 'Tiket Ditutup'}
                          {tipe.buka && <ArrowRight className="h-4 w-4" />}
                        </button>
                        <p className="text-center text-[11px] leading-relaxed text-slate-400">
                          Pembayaran via QRIS. QR tiket aktif setelah bukti diverifikasi.
                        </p>
                      </div>
                    </div>
                  </aside>
                </div>
              </section>
            )}
          </>
        )}

        {step === 2 && pesanan && (
          <section>
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                <Clock3 className="h-3.5 w-3.5" /> Menunggu pembayaran
              </span>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Selesaikan pembayaran</h1>
              <p className="mt-2 text-sm text-slate-500">
                Pesanan <span className="font-semibold text-slate-800">{pesanan.no_pesanan}</span> berhasil dibuat.
                Scan QRIS di bawah, lalu upload bukti bayar.
              </p>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/40">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600">
                    <TicketCheck className="h-4 w-4" />
                  </span>
                  <h2 className="text-base font-semibold text-slate-950">Detail Pesanan</h2>
                </div>
                <dl className="mt-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-sm text-slate-500">No. Pesanan</dt>
                    <dd className="text-sm font-semibold text-slate-900">{pesanan.no_pesanan}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-sm text-slate-500">Nama</dt>
                    <dd className="text-sm font-medium text-slate-900">{pesanan.nama_pembeli}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-sm text-slate-500">Jumlah</dt>
                    <dd className="text-sm font-medium text-slate-900">{pesanan.jumlah} tiket</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <dt className="text-sm font-semibold text-slate-900">Total bayar</dt>
                    <dd className="text-lg font-semibold text-primary-600">{formatRupiah(pesanan.total || 0)}</dd>
                  </div>
                </dl>

                <div className="mt-5 space-y-2 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
                  <p className="flex items-start gap-2">
                    <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Bayar sesuai nominal tanpa membulatkan.
                  </p>
                  <p className="flex items-start gap-2">
                    <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Scan QRIS lewat e-wallet atau m-banking.
                  </p>
                  <p className="flex items-start gap-2">
                    <Upload className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Upload bukti yang jelas agar cepat diverifikasi.
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200/70 bg-white p-5 text-center shadow-sm shadow-slate-200/40">
                <div className="flex items-center justify-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-50 text-primary-600">
                    <QrCode className="h-4 w-4" />
                  </span>
                  <h2 className="text-base font-semibold text-slate-950">Scan QRIS</h2>
                </div>

                <div className="mx-auto mt-5 w-full max-w-[280px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  {qr ? (
                    <div className="relative aspect-square w-full">
                      <img src={qr} alt="QRIS" className="h-full w-full rounded-xl object-contain" />
                      <span className="pointer-events-none absolute inset-0 grid place-items-center">
                        <span className="grid h-20 w-20 place-items-center rounded-full border border-slate-200 bg-white p-1.5 shadow-sm">
                          <img src="/favicon.png" alt="Logo" className="h-full w-full object-contain" />
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div className="aspect-square w-full animate-pulse rounded-xl bg-slate-100" />
                  )}
                </div>

                <div className="mt-5 text-left">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Bukti Pembayaran</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-white text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-700"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">JPG/PNG/WebP, maksimal 5MB.</p>
                  {preview && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1.5">
                      <img
                        src={preview}
                        alt="Preview bukti pembayaran"
                        className="max-h-56 w-full rounded-lg object-contain"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={upload}
                  disabled={uploading || !file}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-600/20 transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? 'Mengupload...' : 'Upload Bukti Bayar'}
                </button>
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="mx-auto max-w-xl">
            <div className="rounded-3xl border border-slate-200/70 bg-white p-8 text-center shadow-sm shadow-slate-200/40 sm:p-10">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-amber-100 text-amber-600">
                <Clock3 className="h-7 w-7" />
              </span>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">Menunggu verifikasi</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                Bukti pembayaran sudah terkirim. Setelah diverifikasi admin, QR tiket akan muncul di halaman Lacak
                Pesanan.
              </p>

              <div className="mt-6 space-y-2 rounded-2xl bg-slate-50 p-4 text-left text-xs text-slate-500">
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> Simpan nomor pesanan:{' '}
                  <span className="font-semibold text-slate-800">{pesanan?.no_pesanan}</span>
                </p>
                <p className="flex items-start gap-2">
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Verifikasi biasanya selesai dalam 1×24 jam.
                </p>
                <p className="flex items-start gap-2">
                  <ScanLine className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Tunjukkan QR tiket ke petugas saat scan di hari H.
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                {pesanan?.no_pesanan && pesanan.t && (
                  <Link
                    href={`/lacak/${pesanan.no_pesanan}?t=${encodeURIComponent(pesanan.t)}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-600/20 transition hover:bg-primary-700"
                  >
                    Buka Riwayat Tiket <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-primary-200 hover:text-primary-700"
                >
                  Kembali ke Beranda
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
