'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'

import { PublicBreadcrumb, PublicNavbar } from '@/components/public-navbar'
import { PoStepper } from '@/components/po-stepper'
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
    kategori_sewa_id: '', jenis_usaha: 'F&B' as 'F&B' | 'Non-F&B', jumlah_tenant: '1',
  })
  const [addonQty, setAddonQty] = useState<Record<string, number>>({})
  const [addonOwn, setAddonOwn] = useState<Record<string, number>>({})
  const [pilihanQty, setPilihanQty] = useState<Record<string, number>>({})
  const [tipeBayar, setTipeBayar] = useState<'lunas' | 'nyicil'>('nyicil')
  const [nominalNyicil, setNominalNyicil] = useState('')
  const [pendaftaran, setPendaftaran] = useState<{ id: string; kode_pendaftaran: string; nama_usaha: string; kontak: string; harga_akhir: number; dp_wajib: number; addon?: TenantAddon[] | null; t?: string } | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [qr, setQr] = useState('')

  useEffect(() => {
    Promise.all([
      getJSON<Katalog>('/api/public/tenant/katalog'),
      getJSON<Peralatan[]>('/api/peralatan').catch(() => []),
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
  const addons = useMemo(() => peralatan.filter((p) => Number(p.harga_sewa) > 0), [peralatan])
  const selectedKategori = kategori.find((k) => k.id === form.kategori_sewa_id)
  const paketPilihan = useMemo(
    () => pilihan.filter((p) => p.kategori_sewa_id === form.kategori_sewa_id),
    [pilihan, form.kategori_sewa_id],
  )
  const paketBundles = useMemo(
    () => bundles.filter((b) => b.kategori_sewa_id === form.kategori_sewa_id),
    [bundles, form.kategori_sewa_id],
  )

  useEffect(() => {
    setPilihanQty(Object.fromEntries(paketPilihan.map((p) => [p.id, 1])))
  }, [paketPilihan])

  const baseHarga = useMemo(() => {
    if (!periode || !form.kategori_sewa_id) return 0
    const hd = hargaDasar.find((h) => h.kategori_sewa_id === form.kategori_sewa_id && h.jenis_usaha === form.jenis_usaha && h.periode === periode)
    return Number(hd?.harga ?? 0)
  }, [form.kategori_sewa_id, form.jenis_usaha, hargaDasar, periode])

  const pilihanPerTenant = useMemo(() => {
    return Object.entries(pilihanQty).reduce((sum, [id, qty]) => {
      const item = paketPilihan.find((p) => p.id === id)
      return sum + Number(item?.harga ?? 0) * qty
    }, 0)
  }, [pilihanQty, paketPilihan])

  const jumlahTenant = Math.max(1, Number(form.jumlah_tenant) || 1)
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
  const subtotalPaket = (baseHarga + pilihanPerTenant) * jumlahTenant
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
  const totalTagihan = Number(pendaftaran?.harga_akhir ?? 0)
  const minimalPertama = Math.ceil(totalTagihan / 2)
  const nominalBayar = !pendaftaran
    ? 0
    : tipeBayar === 'lunas'
      ? totalTagihan
      : Math.max(minimalPertama, Math.min(totalTagihan, Number(nominalNyicil) || minimalPertama))

  useEffect(() => {
    if (!qris.qris_payload || nominalBayar <= 0) {
      setQr('')
      return
    }
    QRCode.toDataURL(buatQrisDinamis(qris.qris_payload, nominalBayar), { width: 320, margin: 2, errorCorrectionLevel: 'H' }).then(setQr).catch(() => {})
  }, [qris, nominalBayar])

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

  function rapikanJumlahTenant() {
    const max = sisaSlot !== null ? Math.max(1, sisaSlot) : 99
    const value = Math.max(1, Math.min(max, Number(form.jumlah_tenant) || 1))
    setForm((prev) => ({ ...prev, jumlah_tenant: String(value) }))
  }

  async function daftar() {
    if (!periode) return toast.error('Tanggal daftar di luar periode open tenant')
    if (sisaSlot === 0) return toast.error('Slot kategori ini sudah habis')
    try {
      const res = await sendJSON('/api/public/tenant', 'POST', {
        ...form,
        jumlah_tenant: jumlahTenant,
        addon: addonTerpilih.map(({ item, qty }) => ({ id: item.id, qty })),
        pilihan: Object.entries(pilihanQty).map(([id, qty]) => ({ id, qty })),
        periode_daftar: periode,
      })
      setPendaftaran(res as typeof pendaftaran)
      setStep(2)
      toast.success('Pendaftaran berhasil, pilih metode pembayaran')
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function upload() {
    if (!file || !pendaftaran) return toast.error('Pilih file bukti')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'bukti-tenant')
      const up = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json()) as { url: string }
      await sendJSON(`/api/public/tenant/${pendaftaran.id}/bukti`, 'POST', {
        bukti_url: up.url,
        pembayaran_tipe: tipeBayar,
        nominal_bayar: nominalBayar,
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
        <PoStepper steps={STEP} currentStep={step === 1 ? 2 : 3} />

        {step===1 && (
          <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
            <div className="border-b border-slate-100 p-4 sm:p-5">
              <h1 className="text-xl font-semibold text-slate-900">Form Pendaftaran Tenant</h1>
              <p className="text-sm text-slate-500">Isi data usaha dan jumlah tenant. Paket terpilih: <span className="font-medium text-slate-700">{selectedKategori?.nama ?? '-'}</span></p>
            </div>
            <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-4">
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium">Nama Usaha</label><input className={input} placeholder="cth: Kopi Senja" value={form.nama_usaha} onChange={e=>setForm({...form,nama_usaha:e.target.value})}/></div>
              <div><label className="mb-1 block text-sm font-medium">Kontak WA</label><input className={input} type="tel" inputMode="numeric" pattern="[0-9]*" placeholder="08xxxxxxxxxx" value={form.kontak} onChange={e=>setForm({...form,kontak:e.target.value.replace(/\D/g,'')})}/></div>
              <div><label className="mb-1 block text-sm font-medium">Email (opsional)</label><input className={input} type="email" placeholder="nama@email.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium">Alamat</label><input className={input} placeholder="Alamat lengkap stand/usaha" value={form.alamat} onChange={e=>setForm({...form,alamat:e.target.value})}/></div>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium">Deskripsi Usaha</label><textarea className={input} rows={2} placeholder="Ceritakan singkat usaha kamu" value={form.deskripsi_usaha} onChange={e=>setForm({...form,deskripsi_usaha:e.target.value})}/></div>

              <div className="space-y-3 rounded-xl border border-slate-200 p-3.5 md:col-span-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Jenis Usaha</label>
                    <select className={input} value={form.jenis_usaha} onChange={e=>setForm({...form,jenis_usaha:e.target.value as 'F&B' | 'Non-F&B'})}>
                      <option value="F&B">F&B</option>
                      <option value="Non-F&B">Non-F&B</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Jumlah Tenant</label>
                    <input type="number" inputMode="numeric" min={1} max={sisaSlot !== null ? Math.max(1, sisaSlot) : 99} className={input} value={form.jumlah_tenant} onChange={e=>setForm({...form, jumlah_tenant: e.target.value})} onBlur={rapikanJumlahTenant} />
                    {sisaSlot !== null && <p className="mt-1 text-xs text-slate-400">Sisa slot: {sisaSlot}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Paket</label>
                    <div className={`${input} flex items-center bg-slate-50 text-slate-700`}>{selectedKategori?.nama ?? '-'}</div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-900">Pilih paket & item yang mau disewa</p>
                  <p className="text-xs text-slate-500">Semua pilihan paket tercentang otomatis. Hilangkan centang untuk item yang tidak diambil.</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary-200 bg-primary-50/50 px-3 py-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                    <input type="checkbox" checked disabled className="h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600" />
                    <span className="truncate font-medium text-slate-800">{selectedKategori?.nama ?? 'Tempat / Stand'}</span>
                    <span className="shrink-0 text-xs text-slate-500">{formatRupiah(baseHarga)} / tenant</span>
                  </label>
                  <span className="text-xs font-medium text-slate-600">{jumlahTenant} tempat</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {paketPilihan.map((item) => {
                    const checked = pilihanQty[item.id] !== undefined
                    return (
                      <div key={item.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${checked ? 'border-primary-200 bg-primary-50/50' : 'border-slate-100'}`}>
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                          <input type="checkbox" checked={checked} onChange={(e) => togglePilihan(item.id, e.target.checked)} className="h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
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
                            onChange={(e) => setPilihanQty({ ...pilihanQty, [item.id]: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })}
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
                                onChange={(e) => setAddonOwn({ ...addonOwn, [item.id]: Math.max(0, Math.min(jumlahTenant, Number(e.target.value) || 0)) })}
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
                              onChange={(e) => setAddonQty({ ...addonQty, [item.id]: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })}
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
                <div className="text-right">
                  <p className="text-sm text-slate-500">{selectedKategori?.nama ?? 'Tempat'} × {jumlahTenant} tenant</p>
                  <p className="text-sm font-medium text-primary-600">{formatRupiah((baseHarga + pilihanPerTenant) * jumlahTenant)}</p>
                  {addonTotal > 0 && <p className="text-xs text-slate-500">Item lain: {formatRupiah(addonTotal)}</p>}
                  {diskonBundle > 0 && <p className="text-xs text-emerald-600">Diskon bundle: -{formatRupiah(diskonBundle)}</p>}
                  <p className="text-sm font-semibold text-slate-900">Total: {formatRupiah(harga)}</p>
                  <p className="text-xs text-slate-500">Pembayaran pertama min. 50%: {formatRupiah(Math.ceil(harga / 2))}</p>
                </div>
              </div>
              <div className="flex justify-end md:col-span-4">
                <button onClick={daftar} disabled={!periode || !form.nama_usaha || !form.kontak || !form.kategori_sewa_id || sisaSlot === 0} className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">Lanjut ke Pembayaran</button>
              </div>
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
                <div className="text-left">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Nominal cicilan pertama (min. {formatRupiah(minimalPertama)})</label>
                  <input
                    type="number"
                    min={minimalPertama}
                    max={totalTagihan}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10"
                    placeholder={String(minimalPertama)}
                    value={nominalNyicil}
                    onChange={(e) => setNominalNyicil(e.target.value)}
                  />
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
              <input type="file" accept="image/*,application/pdf" onChange={e=>setFile(e.target.files?.[0]||null)} className="block w-full text-sm" />
              <button onClick={upload} disabled={uploading || !file} className="w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{uploading ? 'Mengupload...' : 'Upload Bukti Bayar'}</button>
            </div>
          </div>
        )}

        {step===3 && (
          <div className="rounded-2xl border border-slate-200/70 bg-white p-10 text-center shadow-sm shadow-slate-200/40 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">Bukti Terkirim</h2>
            <p className="text-slate-500">Pendaftaran kamu sedang menunggu verifikasi oleh panitia Dana Usaha. Simpan link berikut untuk melihat riwayat pembayaran dan QR masuk venue.</p>
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
    </div>
  )
}
