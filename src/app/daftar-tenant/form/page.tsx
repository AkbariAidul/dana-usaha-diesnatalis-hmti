'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'

import { PublicBreadcrumb, PublicNavbar } from '@/components/public-navbar'
import { getJSON, sendJSON } from '@/app/dankelola/api'
import { periodeDariTanggal, periodeLabel, KategoriSewa, KategoriPilihan, HargaDasar, PeriodeHarga, Peralatan, TenantAddon } from '@/lib/types'
import { kategoriTenant } from '@/lib/tenant'
import { formatDate, formatRupiah, todayISO } from '@/lib/utils'
import { buatQrisDinamis } from '@/lib/qris'
import QRCode from 'qrcode'

const langkahBreadcrumb = ['Form Pendaftaran', 'Pembayaran DP', 'Bukti Terkirim']

export default function DaftarTenantPublik() {
  const [kategori, setKategori] = useState<KategoriSewa[]>([])
  const [hargaDasar, setHargaDasar] = useState<HargaDasar[]>([])
  const [peralatan, setPeralatan] = useState<Peralatan[]>([])
  const [pilihan, setPilihan] = useState<KategoriPilihan[]>([])
  const [pilihanDipilih, setPilihanDipilih] = useState<string[]>([])
  const [periods, setPeriods] = useState<PeriodeHarga[]>([])
  const [acara, setAcara] = useState<{ tanggal_acara: string } | null>(null)
  const [qris, setQris] = useState<Record<string, string>>({})
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    nama_usaha: '', kontak: '', email: '', alamat: '', deskripsi_usaha: '',
    kategori_sewa_id: '',
  })
  const [addonQty, setAddonQty] = useState<Record<string, number>>({})
  const [pendaftaran, setPendaftaran] = useState<{ id: string; kode_pendaftaran: string; nama_usaha: string; kontak: string; harga_akhir: number; dp_wajib: number; addon?: TenantAddon[] | null; t?: string } | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [qr, setQr] = useState('')

  useEffect(() => {
    Promise.all([
      getJSON<{ kategori: KategoriSewa[]; hargaDasar: HargaDasar[]; periode: PeriodeHarga[] }>('/api/master'),
      getJSON<Peralatan[]>('/api/peralatan'),
      getJSON<KategoriPilihan[]>('/api/public/tenant/pilihan').catch(() => []),
      getJSON<Record<string, string>>('/api/pengaturan/qris'),
      getJSON<{ tanggal_acara: string } | null>('/api/acara')
    ]).then(([m, p, pi, q, a]) => {
      const list = kategoriTenant(m.kategori || [])
      setKategori(list)
      setHargaDasar(m.hargaDasar || [])
      setPeralatan(p || [])
      setPilihan(pi || [])
      setPeriods(m.periode || [])
      setQris(q)
      setAcara(a)
      const semua = (p || []).filter((item) => Number(item.harga_sewa) > 0)
      setAddonQty(Object.fromEntries(semua.map((item) => [item.id, 1])))
      const dipilih = new URLSearchParams(window.location.search).get('kategori')
      const kategoriId = dipilih && list.some((k) => k.id === dipilih) ? dipilih : list[0]?.id ?? ''
      setForm((prev) => ({ ...prev, kategori_sewa_id: kategoriId }))
    })
  }, [])

  const periode = periodeDariTanggal(todayISO(), periods)
  const addons = useMemo(() => peralatan.filter((p) => Number(p.harga_sewa) > 0), [peralatan])
  const selectedKategori = kategori.find((k) => k.id === form.kategori_sewa_id)
  const paketPilihan = useMemo(
    () => pilihan.filter((p) => p.kategori_sewa_id === form.kategori_sewa_id),
    [pilihan, form.kategori_sewa_id]
  )
  const pilihanTerpilih = useMemo(
    () => paketPilihan.filter((p) => pilihanDipilih.includes(p.id)),
    [paketPilihan, pilihanDipilih]
  )

  const baseHarga = useMemo(() => {
    if (!periode || !form.kategori_sewa_id) return 0
    const hd = hargaDasar.find((h) => h.kategori_sewa_id === form.kategori_sewa_id && h.jenis_usaha === 'F&B' && h.periode === periode)
      ?? hargaDasar.find((h) => h.kategori_sewa_id === form.kategori_sewa_id && h.periode === periode)
    return Number(hd?.harga ?? 0)
  }, [form.kategori_sewa_id, hargaDasar, periode])

  const addonTotal = useMemo(() => {
    return Object.entries(addonQty).reduce((sum, [id, qty]) => {
      const item = addons.find((p) => p.id === id)
      return sum + Number(item?.harga_sewa ?? 0) * qty
    }, 0)
  }, [addonQty, addons])

  const pilihanTotal = pilihanTerpilih.reduce((sum, p) => sum + Number(p.harga), 0)
  const harga = baseHarga + addonTotal + pilihanTotal
  const dp = Math.ceil(harga / 2)

  useEffect(() => {
    setPilihanDipilih([])
  }, [form.kategori_sewa_id])

  useEffect(() => {
    const nominal = pendaftaran?.dp_wajib
    if (!qris.qris_payload || !nominal) {
      setQr('')
      return
    }
    const payload = buatQrisDinamis(qris.qris_payload, nominal)
    QRCode.toDataURL(payload, { width: 320, margin: 2, errorCorrectionLevel: 'H' }).then(setQr).catch(()=>{})
  }, [qris, pendaftaran])

  function toggleAddon(id: string, checked: boolean) {
    setAddonQty((prev) => {
      const next = { ...prev }
      if (checked) next[id] = Math.max(1, next[id] || 1)
      else delete next[id]
      return next
    })
  }

  async function daftar() {
    if (!periode) return toast.error('Tanggal daftar di luar periode open tenant')
    try {
      const res = await sendJSON('/api/public/tenant', 'POST', {
        ...form,
        addon: Object.entries(addonQty).map(([id, qty]) => ({ id, qty })),
        pilihan: pilihanDipilih,
        periode_daftar: periode,
        harga_akhir: harga,
        dp_wajib: dp,
      })
      setPendaftaran(res as typeof pendaftaran)
      setStep(2)
      toast.success('Pendaftaran berhasil, silakan bayar DP')
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function upload() {
    if (!file || !pendaftaran) return toast.error('Pilih file bukti')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'bukti-tenant')
      const up = await fetch('/api/upload', { method: 'POST', body: fd }).then(r=>r.json()) as { url: string }
      await sendJSON(`/api/public/tenant/${pendaftaran.id}/bukti`, 'POST', { bukti_url: up.url })
      toast.success('Bukti berhasil diupload, menunggu verifikasi admin')
      setStep(3)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setUploading(false) }
  }

  const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <PublicNavbar title="Pendaftaran Tenant" subtitle="Dana Usaha HMTI" maxWidth="max-w-4xl" />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <PublicBreadcrumb
          items={[
            { label: 'Beranda', href: '/' },
            { label: 'Info Tenant', href: '/daftar-tenant' },
            { label: langkahBreadcrumb[step - 1] ?? 'Form Pendaftaran' },
          ]}
        />
        {step===1 && (
          <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
            <div className="p-6 border-b border-slate-100">
              <h1 className="text-xl font-semibold text-slate-900">Form Pendaftaran Tenant</h1>
              <p className="text-sm text-slate-500">Isi data usaha dan pilih item yang mau disewa.</p>
            </div>
            <div className="p-6 grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium">Nama Usaha</label><input className={input} placeholder="cth: Kopi Senja" value={form.nama_usaha} onChange={e=>setForm({...form,nama_usaha:e.target.value})}/></div>
              <div><label className="mb-1 block text-sm font-medium">Kontak WA</label><input className={input} placeholder="08xxxxxxxxxx" value={form.kontak} onChange={e=>setForm({...form,kontak:e.target.value})}/></div>
              <div><label className="mb-1 block text-sm font-medium">Email (opsional)</label><input className={input} placeholder="nama@email.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium">Alamat</label><input className={input} placeholder="Alamat lengkap stand/usaha" value={form.alamat} onChange={e=>setForm({...form,alamat:e.target.value})}/></div>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium">Deskripsi Usaha</label><textarea className={input} placeholder="Ceritakan singkat usaha kamu" value={form.deskripsi_usaha} onChange={e=>setForm({...form,deskripsi_usaha:e.target.value})}/></div>

              <div className="md:col-span-2 rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-medium text-slate-900">Pilih yang mau disewa</p>
                <p className="text-xs text-slate-500">Semua item tercentang di awal. Hilangkan centang untuk item yang tidak diambil.</p>
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50/50 px-3 py-2">
                    <label className="flex flex-1 items-center gap-2 text-sm">
                      <input type="checkbox" checked disabled className="h-4 w-4 rounded border-slate-300 text-primary-600" />
                      <span className="font-medium text-slate-800">{selectedKategori?.nama ?? 'Tempat / Stand'}</span>
                      <span className="text-xs text-slate-500">{formatRupiah(baseHarga)}</span>
                    </label>
                    <span className="text-xs text-slate-400">Wajib</span>
                  </div>
                  {addons.map((item) => {
                    const checked = addonQty[item.id] !== undefined
                    return (
                      <div key={item.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 ${checked ? 'border-primary-200 bg-primary-50/50' : 'border-slate-100'}`}>
                        <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                          <input type="checkbox" checked={checked} onChange={(e) => toggleAddon(item.id, e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                          <span className="font-medium text-slate-800">{item.nama}</span>
                          <span className="text-xs text-slate-500">{formatRupiah(Number(item.harga_sewa))}</span>
                        </label>
                        {checked && (
                          <label className="flex items-center gap-2 text-xs text-slate-500">
                            Jumlah
                            <input
                              type="number"
                              min={1}
                              max={99}
                              className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm"
                              value={addonQty[item.id]}
                              onChange={(e) => setAddonQty({ ...addonQty, [item.id]: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })}
                            />
                          </label>
                        )}
                      </div>
                    )
                  })}
                  {paketPilihan.length > 0 && (
                    <div className="space-y-2 border-t border-slate-200 pt-3">
                      <p className="text-sm font-medium text-slate-900">Pilihan Paket</p>
                      {paketPilihan.map((item) => {
                        const checked = pilihanDipilih.includes(item.id)
                        return (
                          <label key={item.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 cursor-pointer ${checked ? 'border-primary-200 bg-primary-50/50' : 'border-slate-100'}`}>
                            <span className="flex flex-1 items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => setPilihanDipilih((prev) => e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id))}
                                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                              />
                              <span className="font-medium text-slate-800">{item.nama}</span>
                            </span>
                            <span className="text-xs text-slate-500">{Number(item.harga) > 0 ? formatRupiah(Number(item.harga)) : 'Gratis'}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-2 rounded-xl bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <p>Periode: <span className="font-medium">{periode ? periodeLabel(periode, periods) : 'Di luar periode'}</span></p>
                  <p className="text-slate-500">{periods.map((p)=>`${p.nama} ${p.tanggal_mulai}–${p.tanggal_selesai}`).join(' • ')}</p>
                  {acara?.tanggal_acara && <p className="text-slate-500">Tanggal Acara: {formatDate(acara.tanggal_acara)}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Tempat</p>
                  <p className="text-lg font-semibold text-primary-600">{formatRupiah(baseHarga)}</p>
                  {addonTotal > 0 && <p className="text-xs text-slate-500">Item lain: {formatRupiah(addonTotal)}</p>}
                  {pilihanTotal > 0 && <p className="text-xs text-slate-500">Pilihan paket: {formatRupiah(pilihanTotal)}</p>}
                  <p className="text-sm font-semibold text-slate-900">Total: {formatRupiah(harga)}</p>
                  <p className="text-xs text-slate-500">DP 50% {formatRupiah(dp)}</p>
                </div>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button onClick={daftar} disabled={!periode || !form.nama_usaha || !form.kontak || !form.kategori_sewa_id} className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">Lanjut ke Pembayaran</button>
              </div>
            </div>
          </div>
        )}

        {step===2 && pendaftaran && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Data Pendaftaran</h2>
              <div className="text-sm space-y-1">
                <p><span className="text-slate-500">Kode</span> : {pendaftaran.kode_pendaftaran}</p>
                <p><span className="text-slate-500">Usaha</span> : {pendaftaran.nama_usaha}</p>
                <p><span className="text-slate-500">Kontak</span> : {pendaftaran.kontak}</p>
                <p><span className="text-slate-500">Harga</span> : {formatRupiah(pendaftaran.harga_akhir)}</p>
                <p><span className="text-slate-500">DP Wajib</span> : {formatRupiah(pendaftaran.dp_wajib)}</p>
                {pendaftaran.addon && pendaftaran.addon.length > 0 && (
                  <div className="pt-2">
                    <p className="text-slate-500">Add-on</p>
                    <ul className="mt-1 space-y-0.5">
                      {pendaftaran.addon.map((a) => (
                        <li key={a.id}>• {a.nama} × {a.qty} — {formatRupiah(a.subtotal)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 space-y-4 text-center">
              <h2 className="text-lg font-semibold text-slate-900">Scan QRIS untuk Bayar DP</h2>
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
              <p className="text-xs text-slate-400">Transfer sesuai nominal DP lalu upload bukti dibawah ini.</p>
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
