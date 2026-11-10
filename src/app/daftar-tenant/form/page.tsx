'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'

import { PublicBreadcrumb, PublicNavbar } from '@/components/public-navbar'
import { PoStepper } from '@/components/po-stepper'
import { Turnstile, type TurnstileHandle } from '@/components/turnstile'
import { getJSON, sendJSON } from '@/app/dankelola/api'
import {
  periodeDariTanggal,
  type Acara,
  type HargaDasar,
  type KategoriBundleDiscount,
  type KategoriPilihan,
  type KategoriSewa,
  type Peralatan,
  type PeriodeHarga,
  type TenantAddon,
} from '@/lib/types'
import { kategoriTenant } from '@/lib/tenant'
import { formatDate, formatRupiah, todayISO } from '@/lib/utils'
import { buatQrisDinamis } from '@/lib/qris'
import QRCode from 'qrcode'

const langkahBreadcrumb = ['Form Pendaftaran', 'Pembayaran', 'Bukti Terkirim']
const STEP = [{ label: 'Pilih Paket' }, { label: 'Form Pendaftaran' }, { label: 'Pembayaran & QR' }]
const TURNSTILE_ENABLED = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

type Katalog = {
  kategori: KategoriSewa[]
  hargaDasar: HargaDasar[]
  periode: PeriodeHarga[]
  pilihan: KategoriPilihan[]
  bundles: KategoriBundleDiscount[]
  acara: Acara | null
  terpakai: Record<string, number>
}

export default function DaftarTenantPublik() {
  const [kategori, setKategori] = useState<KategoriSewa[]>([])
  const [hargaDasar, setHargaDasar] = useState<HargaDasar[]>([])
  const [peralatan, setPeralatan] = useState<Peralatan[]>([])
  const [pilihan, setPilihan] = useState<KategoriPilihan[]>([])
  const [bundles, setBundles] = useState<KategoriBundleDiscount[]>([])
  const [periods, setPeriods] = useState<PeriodeHarga[]>([])
  const [acara, setAcara] = useState<Acara | null>(null)
  const [terpakai, setTerpakai] = useState<Record<string, number>>({})
  const [qris, setQris] = useState<Record<string, string>>({})
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    nama_usaha: '', kontak: '', email: '', alamat: '', deskripsi_usaha: '',
    kategori_sewa_id: '', jumlah_fnb: '1', jumlah_nonfnb: '0',
  })
  const [addonQty, setAddonQty] = useState<Record<string, number | ''>>({})
  const [addonOwn, setAddonOwn] = useState<Record<string, number | ''>>({})
  const [pilihanQty, setPilihanQty] = useState<Record<string, number | ''>>({})
  const [tipeBayar, setTipeBayar] = useState<'lunas' | 'nyicil'>('nyicil')
  const [nominalNyicil, setNominalNyicil] = useState('')
  const [pendaftaran, setPendaftaran] = useState<{ id: string; kode_pendaftaran: string; nama_usaha: string; kontak: string; harga_akhir: number; dp_wajib: number; addon?: TenantAddon[] | null; t?: string } | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [qr, setQr] = useState('')
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [bannerDibuka, setBannerDibuka] = useState(true)
  const [waitlist, setWaitlist] = useState<{ id: string; harga_akhir: number } | null>(null)
  const turnstileRef = useRef<TurnstileHandle>(null)
  const turnstileLock = useRef(false)
  const submittingTenant = useRef(false)

  useEffect(() => {
    Promise.all([
      getJSON<Katalog>('/api/public/tenant/katalog'),
      getJSON<Peralatan[]>('/api/public/peralatan').catch(() => []),
      getJSON<Record<string, string>>('/api/pengaturan/qris'),
    ]).then(([k, p, q]) => {
      const list = kategoriTenant(k.kategori || [])
      setKategori(list)
      setHargaDasar(k.hargaDasar || [])
      setPeralatan(p || [])
      setPilihan(k.pilihan || [])
      setBundles(k.bundles || [])
      setPeriods(k.periode || [])
      setAcara(k.acara ?? null)
      setTerpakai(k.terpakai || {})
      setQris(q)
      const dipilih = new URLSearchParams(window.location.search).get('kategori')
      const kategoriId = dipilih && list.some((x) => x.id === dipilih) ? dipilih : list[0]?.id ?? ''
      setForm((prev) => ({ ...prev, kategori_sewa_id: kategoriId }))
    })
  }, [])

  const periode = periodeDariTanggal(todayISO(), periods)
  const hariIni = todayISO()
  const periodePertama = periods.length ? periods.reduce((min, p) => (p.tanggal_mulai < min ? p.tanggal_mulai : min), periods[0].tanggal_mulai) : ''
  const periodeTerakhir = periods.length ? periods.reduce((max, p) => (p.tanggal_selesai > max ? p.tanggal_selesai : max), periods[0].tanggal_selesai) : ''
  const pendaftaranTutup = periods.length > 0 && !periode && hariIni > periodeTerakhir
  const pendaftaranBelumBuka = periods.length > 0 && !periode && hariIni < periodePertama
  const infoPeriode = pendaftaranTutup || pendaftaranBelumBuka
  const addons = useMemo(() => peralatan.filter((p) => Number(p.harga_sewa) > 0), [peralatan])
  const selectedKategori = kategori.find((k) => k.id === form.kategori_sewa_id)
  const paketPilihan = useMemo(
    () => pilihan.filter((p) => p.kategori_sewa_id === form.kategori_sewa_id),
    [pilihan, form.kategori_sewa_id],
  )
  const pilihanTambahan = useMemo(
    () => paketPilihan.filter((p) => !/^tempat\b/i.test(p.nama.trim())),
    [paketPilihan],
  )
  const paketBundles = useMemo(
    () => bundles.filter((b) => b.kategori_sewa_id === form.kategori_sewa_id),
    [bundles, form.kategori_sewa_id],
  )

  useEffect(() => {
    setPilihanQty(Object.fromEntries(pilihanTambahan.map((p) => [p.id, 1])))
  }, [pilihanTambahan])

  const hargaFnb = useMemo(() => {
    if (!periode || !form.kategori_sewa_id) return 0
    const hd = hargaDasar.find((h) => h.kategori_sewa_id === form.kategori_sewa_id && h.jenis_usaha === 'F&B' && h.periode === periode)
    return Number(hd?.harga ?? 0)
  }, [form.kategori_sewa_id, hargaDasar, periode])

  const hargaNonFnb = useMemo(() => {
    if (!periode || !form.kategori_sewa_id) return 0
    const hd = hargaDasar.find((h) => h.kategori_sewa_id === form.kategori_sewa_id && h.jenis_usaha === 'Non-F&B' && h.periode === periode)
    return Number(hd?.harga ?? 0)
  }, [form.kategori_sewa_id, hargaDasar, periode])

  const pilihanTotal = useMemo(() => {
    return Object.entries(pilihanQty).reduce((sum, [id, qty]) => {
      const item = pilihanTambahan.find((p) => p.id === id)
      return sum + Number(item?.harga ?? 0) * (Number(qty) || 1)
    }, 0)
  }, [pilihanQty, pilihanTambahan])

  const jumlahFnb = Math.max(0, Number(form.jumlah_fnb) || 0)
  const jumlahNonFnb = Math.max(0, Number(form.jumlah_nonfnb) || 0)
  const jumlahTenant = jumlahFnb + jumlahNonFnb
  const pilihanTerpilih = pilihanTambahan.filter((p) => pilihanQty[p.id] !== undefined)
  const addonTerpilih = addons
    .map((item) => {
      if (addonQty[item.id] === undefined) return { item, qty: 0 }
      const otomatis = item.jenis === 'Tenda' || item.jenis === 'Meja'
      if (!otomatis) return { item, qty: Math.max(1, Number(addonQty[item.id]) || 1) }
      const bawaSendiri = Math.min(jumlahTenant, Math.max(0, Number(addonOwn[item.id]) || 0))
      return { item, qty: Math.max(0, jumlahTenant - bawaSendiri) }
    })
    .filter(({ qty }) => qty > 0)
  const addonTotal = addonTerpilih.reduce((sum, { item, qty }) => sum + Number(item.harga_sewa) * qty, 0)
  const subtotalPaket =
    hargaFnb * jumlahFnb + hargaNonFnb * jumlahNonFnb + pilihanTotal
  const bundleAktif = [...paketBundles]
    .filter((b) => jumlahTenant >= Number(b.jumlah_min))
    .sort((a, b) => Number(b.jumlah_min) - Number(a.jumlah_min))[0] ?? null
  const diskonBundle = bundleAktif
    ? Math.min(subtotalPaket, Number(bundleAktif.diskon_nominal) + subtotalPaket * (Number(bundleAktif.diskon_persen) / 100))
    : 0
  const harga = Math.max(0, Math.round(subtotalPaket - diskonBundle) + addonTotal)
  const sisaSlot = selectedKategori && Number(selectedKategori.slot_tenant) > 0
    ? Math.max(0, Number(selectedKategori.slot_tenant) - Number(terpakai[selectedKategori.id] ?? 0))
    : null
  const slotHabis = sisaSlot === 0
  const modeWaitlist = slotHabis && !!periode
  const maxTenant = sisaSlot !== null && sisaSlot > 0 ? sisaSlot : 99
  const totalTagihan = Number(pendaftaran?.harga_akhir ?? 0)
  const minimalPertama = Math.ceil(totalTagihan / 2)
  const nominalBayar = !pendaftaran
    ? 0
    : tipeBayar === 'lunas'
      ? totalTagihan
      : Math.max(minimalPertama, Math.min(totalTagihan, Number(nominalNyicil) || minimalPertama))
  const nominalKurang = tipeBayar === 'nyicil' && nominalNyicil !== '' && Number(nominalNyicil) < minimalPertama

  useEffect(() => {
    if (!qris.qris_payload || nominalBayar <= 0) {
      setQr('')
      return
    }
    QRCode.toDataURL(buatQrisDinamis(qris.qris_payload, nominalBayar), { width: 320, margin: 2, errorCorrectionLevel: 'H' }).then(setQr).catch(() => {})
  }, [qris, nominalBayar])

  useEffect(() => {
    if (!pendaftaran || tipeBayar !== 'nyicil') return
    setNominalNyicil((prev) => {
      const min = Math.ceil(Number(pendaftaran.harga_akhir) / 2)
      return !prev || Number(prev) < min ? String(min) : prev
    })
  }, [pendaftaran, tipeBayar])

  useEffect(() => {
    if (!file) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function toggleAddon(id: string, checked: boolean) {
    setAddonQty((prev) => {
      const next = { ...prev }
      if (checked) next[id] = Math.max(1, next[id] || 1)
      else delete next[id]
      return next
    })
  }

  function togglePilihan(id: string, checked: boolean) {
    setPilihanQty((prev) => {
      const next = { ...prev }
      if (checked) next[id] = 1
      else delete next[id]
      return next
    })
  }

  function rapikanJumlah(field: 'jumlah_fnb' | 'jumlah_nonfnb') {
    const value = Math.max(0, Math.min(maxTenant, Number(form[field]) || 0))
    setForm((prev) => ({ ...prev, [field]: String(value) }))
  }

  async function daftar() {
    if (submittingTenant.current) return
    if (!periode) return toast.error('Tanggal daftar di luar periode open tenant')
    if (!modeWaitlist && sisaSlot === 0) return toast.error('Slot kategori ini sudah habis')
    if (jumlahTenant < 1) return toast.error('Isi minimal 1 tenant (F&B atau Non-F&B)')
    if (!modeWaitlist && sisaSlot !== null && jumlahTenant > sisaSlot) return toast.error(`Sisa slot hanya ${sisaSlot}`)
    submittingTenant.current = true
    try {
      let token = turnstileRef.current?.getToken() ?? null
      if (TURNSTILE_ENABLED && !token) {
        if (turnstileLock.current) return
        turnstileLock.current = true
        const id = toast.loading('Menunggu verifikasi Cloudflare…')
        try {
          token = await turnstileRef.current?.waitForToken() ?? null
        } finally {
          toast.dismiss(id)
          turnstileLock.current = false
        }
        if (!token) {
          toast.error('Verifikasi Cloudflare belum selesai. Coba lagi.')
          return
        }
      }
      const payload = {
        nama_usaha: form.nama_usaha,
        kontak: form.kontak,
        email: form.email,
        alamat: form.alamat,
        deskripsi_usaha: form.deskripsi_usaha,
        kategori_sewa_id: form.kategori_sewa_id,
        jenis_usaha_qty: { fnb: jumlahFnb, nonFnb: jumlahNonFnb },
        addon: addonTerpilih.map(({ item, qty }) => ({ id: item.id, qty })),
        pilihan: Object.entries(pilihanQty).map(([id, qty]) => ({ id, qty: Math.max(1, Number(qty) || 1) })),
        turnstile_token: token,
      }
      if (modeWaitlist) {
        const created = await sendJSON('/api/public/tenant/waitlist', 'POST', payload) as { id: string; harga_akhir: number }
        setWaitlist(created)
        toast.success('Kamu masuk daftar tunggu. Kami hubungi via WhatsApp jika slot tersedia.')
        return
      }
      const res = await sendJSON('/api/public/tenant', 'POST', { ...payload, periode_daftar: periode })
      const created = res as typeof pendaftaran
      setPendaftaran(created)
      setNominalNyicil(String(Math.ceil(Number(created?.harga_akhir ?? 0) / 2)))
      setStep(2)
      toast.success('Pendaftaran berhasil, pilih metode pembayaran')
    } catch (e: unknown) {
      turnstileRef.current?.reset()
      toast.error((e as Error).message)
    } finally {
      submittingTenant.current = false
    }
  }

  function pilihBukti(next: File | null) {
    if (!next) {
      setFile(null)
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) {
      toast.error('Format bukti harus JPG, PNG, atau WebP')
      return
    }
    if (next.size > 5 * 1024 * 1024) {
      toast.error('Ukuran bukti maksimal 5MB')
      return
    }
    setFile(next)
  }

  async function upload() {
    if (!file || !pendaftaran) return toast.error('Pilih file bukti')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'bukti-tenant')
      const up = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json()) as { url: string; error?: string }
      if (!up.url) throw new Error(up.error || 'Upload gagal')
      await sendJSON(`/api/public/tenant/${pendaftaran.id}/bukti`, 'POST', {
        bukti_url: up.url,
        pembayaran_tipe: tipeBayar,
        nominal_bayar: nominalBayar,
        t: pendaftaran.t,
      })
      toast.success('Bukti berhasil diupload, menunggu verifikasi admin')
      setStep(3)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setUploading(false) }
  }

  const input = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'
  const wrapper = 'mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8'

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <PublicNavbar title="Pendaftaran Tenant" subtitle="Dana Usaha HMTI" maxWidth="max-w-[1600px]" />

      <main className={`${wrapper} space-y-6 py-8`}>
        <PublicBreadcrumb
          items={[
            { label: 'Beranda', href: '/' },
            { label: 'Info Tenant', href: '/daftar-tenant' },
            { label: langkahBreadcrumb[step - 1] ?? 'Form Pendaftaran' },
          ]}
        />
        {!waitlist && <PoStepper steps={STEP} currentStep={step === 1 ? 2 : 3} />}

        {step===1 && !waitlist && (
          <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
            <div className="border-b border-slate-100 p-4 sm:p-5">
              <h1 className="text-xl font-semibold text-slate-900">Form Pendaftaran Tenant</h1>
              <p className="text-sm text-slate-500">Isi data usaha dan jumlah tenant. Paket terpilih: <span className="font-medium text-slate-700">{selectedKategori?.nama ?? '-'}</span></p>
            </div>
            {modeWaitlist && (
              <div className="mx-4 mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700 sm:mx-5 sm:mt-5">
                <p className="font-semibold">Slot paket ini sudah habis.</p>
                <p className="mt-1 text-xs leading-relaxed text-rose-600">
                  Kamu tetap bisa mengisi form untuk masuk daftar tunggu. Kami akan menghubungi via WhatsApp jika ada slot tersedia.
                </p>
                <Link href="/daftar-tenant#kategori" className="mt-2 inline-flex text-xs font-semibold text-rose-700 underline">
                  Lihat paket lain
                </Link>
              </div>
            )}
            <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-4">
              {infoPeriode && (
                <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 md:col-span-4">
                  {pendaftaranTutup
                    ? `Pendaftaran tenant sudah ditutup sejak ${formatDate(periodeTerakhir)}.`
                    : `Pendaftaran tenant dibuka mulai ${formatDate(periodePertama)}.`}
                </div>
              )}
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium">Nama Usaha</label><input className={input} placeholder="cth: Kopi Senja" value={form.nama_usaha} onChange={e=>setForm({...form,nama_usaha:e.target.value})}/></div>
              <div><label className="mb-1 block text-sm font-medium">Kontak WA</label><input className={input} type="tel" inputMode="numeric" pattern="[0-9]*" placeholder="08xxxxxxxxxx" value={form.kontak} onChange={e=>setForm({...form,kontak:e.target.value.replace(/\D/g,'')})}/></div>
              <div><label className="mb-1 block text-sm font-medium">Email (opsional)</label><input className={input} type="email" placeholder="nama@email.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium">Alamat</label><input className={input} placeholder="Alamat lengkap stand/usaha" value={form.alamat} onChange={e=>setForm({...form,alamat:e.target.value})}/></div>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium">Deskripsi Usaha</label><textarea className={input} rows={2} placeholder="Ceritakan singkat usaha kamu" value={form.deskripsi_usaha} onChange={e=>setForm({...form,deskripsi_usaha:e.target.value})}/></div>

              <div className="space-y-3 rounded-xl border border-slate-200 p-3.5 md:col-span-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Jumlah Tenant F&B</label>
                    <input type="number" inputMode="numeric" min={0} max={maxTenant} className={input} value={form.jumlah_fnb} onChange={e=>setForm({...form, jumlah_fnb: e.target.value})} onBlur={()=>rapikanJumlah('jumlah_fnb')} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Jumlah Tenant Non-F&B</label>
                    <input type="number" inputMode="numeric" min={0} max={maxTenant} className={input} value={form.jumlah_nonfnb} onChange={e=>setForm({...form, jumlah_nonfnb: e.target.value})} onBlur={()=>rapikanJumlah('jumlah_nonfnb')} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Paket</label>
                    <div className={`${input} flex items-center bg-slate-50 text-slate-700`}>{selectedKategori?.nama ?? '-'}</div>
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  Total tenant dipilih: <span className="font-medium text-slate-700">{jumlahTenant}</span>
                  {sisaSlot !== null && <> · Sisa slot paket ini: <span className="font-medium text-slate-700">{sisaSlot}</span> (untuk semua jenis usaha)</>}
                </p>

                <div>
                  <p className="text-sm font-medium text-slate-900">Pilih paket & item yang mau disewa</p>
                  <p className="text-xs text-slate-500">Tempat wajib diambil sesuai jumlah tenant. Pilihan lain tercentang otomatis, hilangkan centang untuk item yang tidak diambil. Jumlah = total unit yang disewa.</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary-200 bg-primary-50/50 px-3 py-2">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm">
                    <input type="checkbox" checked disabled className="h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600" />
                    <span className="truncate font-medium text-slate-800">Tempat · {selectedKategori?.nama ?? 'Stand'}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {jumlahFnb > 0 ? `F&B ${formatRupiah(hargaFnb)}/tenant` : ''}
                      {jumlahFnb > 0 && jumlahNonFnb > 0 ? ' · ' : ''}
                      {jumlahNonFnb > 0 ? `Non-F&B ${formatRupiah(hargaNonFnb)}/tenant` : ''}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-slate-600">{jumlahTenant} tempat</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {pilihanTambahan.map((item) => {
                    const checked = pilihanQty[item.id] !== undefined
                    return (
                      <div key={item.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${checked ? 'border-primary-200 bg-primary-50/50' : 'border-slate-100'}`}>
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                          <input type="checkbox" checked={checked} onChange={(e) => togglePilihan(item.id, e.target.checked)} className="h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                          {item.gambar_url && (
                            <Image
                              src={item.gambar_url}
                              alt={item.nama}
                              width={28}
                              height={28}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setFotoPreview(item.gambar_url || null)
                              }}
                              className="h-7 w-7 shrink-0 cursor-zoom-in rounded-md border border-slate-200 object-cover"
                            />
                          )}
                          <span className="truncate font-medium text-slate-800">{item.nama}</span>
                          <span className="shrink-0 text-xs text-slate-500">{Number(item.harga) > 0 ? formatRupiah(Number(item.harga)) : 'Gratis'}</span>
                        </label>
                        {checked && (
                          <input
                            type="number"
                            min={1}
                            max={99}
                            className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm"
                            value={pilihanQty[item.id]}
                            onChange={(e) => {
                              const value = e.target.value
                              setPilihanQty({ ...pilihanQty, [item.id]: value === '' ? '' : Math.max(1, Math.min(99, Number(value) || 1)) })
                            }}
                            onBlur={() => {
                              if (pilihanQty[item.id] === '') setPilihanQty({ ...pilihanQty, [item.id]: 1 })
                            }}
                          />
                        )}
                      </div>
                    )
                  })}
                  {addons.length > 0 && (
                    <p className="text-xs font-medium text-slate-500 sm:col-span-2">Item tambahan (opsional)</p>
                  )}
                  {addons.map((item) => {
                    const checked = addonQty[item.id] !== undefined
                    const otomatis = item.jenis === 'Tenda' || item.jenis === 'Meja'
                    const bawaSendiri = Math.min(jumlahTenant, Math.max(0, Number(addonOwn[item.id]) || 0))
                    const qtyOtomatis = Math.max(0, jumlahTenant - bawaSendiri)
                    return (
                      <div key={item.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${checked ? 'border-primary-200 bg-primary-50/50' : 'border-slate-100'}`}>
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                          <input type="checkbox" checked={checked} onChange={(e) => toggleAddon(item.id, e.target.checked)} className="h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                          <span className="truncate font-medium text-slate-800">{item.nama}</span>
                          <span className="shrink-0 text-xs text-slate-500">{formatRupiah(Number(item.harga_sewa))}</span>
                        </label>
                        {checked && (otomatis ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <label className="flex items-center gap-1">
                              Bawa sendiri
                              <input
                                type="number"
                                min={0}
                                max={jumlahTenant}
                                className="w-12 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm"
                                value={addonOwn[item.id] ?? ''}
                                onChange={(e) => {
                                  const value = e.target.value
                                  setAddonOwn({ ...addonOwn, [item.id]: value === '' ? '' : Math.max(0, Math.min(jumlahTenant, Number(value) || 0)) })
                                }}
                              />
                            </label>
                            <span className="font-medium text-slate-700">Sewa {qtyOtomatis} unit</span>
                          </div>
                        ) : (
                          <label className="flex items-center gap-1 text-xs text-slate-500">
                            Jumlah
                            <input
                              type="number"
                              min={1}
                              max={99}
                              className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm"
                              value={addonQty[item.id]}
                              onChange={(e) => {
                                const value = e.target.value
                                setAddonQty({ ...addonQty, [item.id]: value === '' ? '' : Math.max(1, Math.min(99, Number(value) || 1)) })
                              }}
                              onBlur={() => {
                                if (addonQty[item.id] === '') setAddonQty({ ...addonQty, [item.id]: 1 })
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3.5 md:col-span-4">
                <div className="space-y-0.5 text-xs text-slate-500">
                  {acara?.tanggal_acara && <p>Tanggal Acara: {formatDate(acara.tanggal_acara)}</p>}
                  {acara?.batas_pelunasan && <p>Batas pembayaran: {formatDate(acara.batas_pelunasan)}</p>}
                </div>
                <div className="ml-auto w-full text-right sm:w-auto">
                  <div className="space-y-0.5 text-xs text-slate-500">
                    {jumlahFnb > 0 && <p>F&B × {jumlahFnb}: {formatRupiah(hargaFnb * jumlahFnb)}</p>}
                    {jumlahNonFnb > 0 && <p>Non-F&B × {jumlahNonFnb}: {formatRupiah(hargaNonFnb * jumlahNonFnb)}</p>}
                    {pilihanTerpilih.map((item) => {
                      const qty = Number(pilihanQty[item.id]) || 1
                      return (
                        <p key={item.id}>{item.nama} × {qty}: {formatRupiah(Number(item.harga) * qty)}</p>
                      )
                    })}
                    {addonTotal > 0 && <p>Item tambahan: {formatRupiah(addonTotal)}</p>}
                    {diskonBundle > 0 && <p className="text-emerald-600">Diskon bundle: -{formatRupiah(diskonBundle)}</p>}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Total: {formatRupiah(harga)}</p>
                  <p className="text-xs text-slate-500">Pembayaran pertama min. 50%: {formatRupiah(Math.ceil(harga / 2))}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3 md:col-span-4 sm:flex-row sm:justify-end">
                <Turnstile ref={turnstileRef} />
                <button onClick={daftar} disabled={!periode || !form.nama_usaha || !form.kontak || !form.kategori_sewa_id || (!modeWaitlist && sisaSlot === 0) || jumlahTenant < 1 || submittingTenant.current} className={`rounded-xl px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${modeWaitlist ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primary-600'}`}>{submittingTenant.current ? 'Mengirim…' : modeWaitlist ? 'Masuk Daftar Tunggu' : 'Lanjut ke Pembayaran'}</button>
              </div>
            </div>
          </div>
        )}

        {waitlist && (
          <div className="rounded-2xl border border-rose-200/70 bg-white p-10 text-center shadow-sm shadow-slate-200/40 space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-lg font-bold text-rose-600">✓</div>
            <h2 className="text-xl font-semibold text-slate-900">Kamu Masuk Daftar Tunggu</h2>
            <p className="text-slate-500">
              Paket <span className="font-medium text-slate-700">{selectedKategori?.nama ?? '-'}</span> sedang penuh. Data kamu sudah kami simpan.
              Kami akan menghubungi via WhatsApp jika ada slot tersedia.
            </p>
            <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              Estimasi harga: <span className="font-semibold text-slate-700">{formatRupiah(waitlist.harga_akhir)}</span>
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/daftar-tenant#kategori" className="inline-flex rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white">
                Lihat Paket Lain
              </Link>
              <Link href="/" className="inline-flex rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600">
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        )}

        {step===2 && pendaftaran && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Ringkasan Pendaftaran</h2>
              <div className="text-sm space-y-1">
                <p><span className="text-slate-500">Kode</span> : {pendaftaran.kode_pendaftaran}</p>
                <p><span className="text-slate-500">Usaha</span> : {pendaftaran.nama_usaha}</p>
                <p><span className="text-slate-500">Kontak</span> : {pendaftaran.kontak}</p>
                <p><span className="text-slate-500">Total</span> : {formatRupiah(pendaftaran.harga_akhir)}</p>
                <p><span className="text-slate-500">Pembayaran pertama</span> : {formatRupiah(nominalBayar)}</p>
                {acara?.batas_pelunasan && <p><span className="text-slate-500">Batas pembayaran</span> : {formatDate(acara.batas_pelunasan)}</p>}
                {pendaftaran.addon && pendaftaran.addon.length > 0 && (
                  <div className="pt-2">
                    <p className="text-slate-500">Rincian item</p>
                    <ul className="mt-1 space-y-0.5">
                      {pendaftaran.addon.map((a) => (
                        <li key={a.id}>• {a.nama} × {a.qty} — {formatRupiah(a.subtotal)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                QR registrasi tenant aktif setelah total pembayaran terverifikasi mencapai 80%.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 space-y-4 text-center">
              <h2 className="text-lg font-semibold text-slate-900">Pilih Metode Pembayaran</h2>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setTipeBayar('lunas')} className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${tipeBayar === 'lunas' ? 'border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-500/10' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Lunas 100%
                </button>
                <button type="button" onClick={() => setTipeBayar('nyicil')} className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${tipeBayar === 'nyicil' ? 'border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-500/10' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Nyicil (min. 50%)
                </button>
              </div>
              {tipeBayar === 'nyicil' && (
                <div className="space-y-1 text-left">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Nominal cicilan pertama (min. {formatRupiah(minimalPertama)})</label>
                  <input
                    type="number"
                    min={minimalPertama}
                    max={totalTagihan}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10"
                    placeholder={String(minimalPertama)}
                    value={nominalNyicil}
                    onChange={(e) => setNominalNyicil(e.target.value)}
                    onBlur={() => setNominalNyicil(String(Math.max(minimalPertama, Math.min(totalTagihan, Number(nominalNyicil) || minimalPertama))))}
                  />
                  <p className={`text-xs ${nominalKurang ? 'text-red-600' : 'text-slate-500'}`}>
                    Minimal 50% dari total tagihan ({formatRupiah(minimalPertama)}). Nominal boleh lebih besar, tetapi tidak bisa lebih rendah dari batas minimal.
                  </p>
                </div>
              )}
              <h2 className="text-lg font-semibold text-slate-900">Scan QRIS untuk Bayar</h2>
              <div className="mx-auto w-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                {qr ? (
                  <div className="relative h-80 w-80">
                    <img src={qr} alt="QRIS" className="h-full w-full rounded-lg" />
                    <span className="pointer-events-none absolute inset-0 grid place-items-center">
                      <span className="grid h-16 w-16 place-items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                        <img src="/favicon.png" alt="Logo" className="h-full w-full object-contain" />
                      </span>
                    </span>
                  </div>
                ) : <div className="h-80 w-80 skeleton" />}
              </div>
              <p className="text-sm text-slate-500">{qris.qris_nama_merchant || 'Merchant Himpunan'}</p>
              <p className="text-xs text-slate-400">Nominal: {formatRupiah(nominalBayar)}. Transfer sesuai nominal lalu upload bukti di bawah ini.</p>
              <div className="space-y-2 text-left">
                <label className="block text-sm font-medium text-slate-700">Bukti Pembayaran</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => pilihBukti(e.target.files?.[0] ?? null)}
                  className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-white text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100"
                />
                <p className="text-xs text-slate-500">JPG, PNG, atau WebP. Maksimal 5MB.</p>
                {preview && (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1.5">
                    <img src={preview} alt="Pratinjau bukti pembayaran" className="max-h-56 w-full rounded-lg object-contain" />
                  </div>
                )}
              </div>
              <button onClick={upload} disabled={uploading || !file || nominalKurang} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white disabled:bg-slate-200 disabled:text-slate-400">
                <Upload className="h-4 w-4" />
                {uploading ? 'Mengupload...' : 'Upload Bukti Bayar'}
              </button>
            </div>
          </div>
        )}

        {step===3 && (
          <div className="rounded-2xl border border-slate-200/70 bg-white p-10 text-center shadow-sm shadow-slate-200/40 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">Bukti Terkirim</h2>
            <p className="text-slate-500">Pendaftaran kamu sedang menunggu verifikasi oleh panitia Dana Usaha. Simpan link berikut untuk melihat riwayat pembayaran dan QR masuk venue.</p>
            <p className="rounded-xl bg-green-50 p-3 text-xs text-green-800">Di halaman riwayat juga tersedia tombol gabung Grup WhatsApp tenant setelah pembayaran pertama (min. 50%) tervalidasi.</p>
            {pendaftaran?.t && (
              <Link href={`/lacak/${pendaftaran.kode_pendaftaran}?t=${encodeURIComponent(pendaftaran.t)}`} className="inline-flex rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white">
                Buka Riwayat Tenant
              </Link>
            )}
            <p className="text-xs text-slate-400">Kode: {pendaftaran?.kode_pendaftaran}</p>
            <Link href="/" className="inline-flex text-sm font-medium text-primary-600">Kembali ke Beranda</Link>
          </div>
        )}
      </main>

      {fotoPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setFotoPreview(null)}>
          <img src={fotoPreview} alt="Preview foto item" className="max-h-[85vh] max-w-full rounded-xl bg-white object-contain shadow-2xl" />
          <button type="button" onClick={() => setFotoPreview(null)} className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-700">Tutup</button>
        </div>
      )}

      {infoPeriode && bannerDibuka && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setBannerDibuka(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-lg font-bold text-rose-600">!</div>
            <h2 className="text-lg font-semibold text-slate-900">
              {pendaftaranTutup ? 'Pendaftaran Tenant Telah Ditutup' : 'Pendaftaran Tenant Belum Dibuka'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {pendaftaranTutup
                ? `Periode pendaftaran tenant sudah berakhir pada ${formatDate(periodeTerakhir)}. Pendaftaran baru tidak dapat diproses, tetapi kamu masih bisa melihat halaman ini untuk informasi.`
                : `Pendaftaran tenant akan dibuka pada ${formatDate(periodePertama)}. Silakan kembali pada tanggal tersebut untuk mendaftar.`}
            </p>
            <button type="button" onClick={() => setBannerDibuka(false)} className="mt-5 w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white">Mengerti</button>
          </div>
        </div>
      )}
    </div>
  )
}
