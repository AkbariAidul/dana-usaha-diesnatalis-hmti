'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { CheckCircle2, ChevronLeft, Package } from 'lucide-react'
import { PublicNavbar } from '@/components/public-navbar'
import { PoStepper } from '@/components/po-stepper'
import { Turnstile, type TurnstileHandle } from '@/components/turnstile'
import { getJSON } from '@/app/dankelola/api'
import { formatRupiah } from '@/lib/utils'
import { buatQrisDinamis } from '@/lib/qris'
import { opsiLengan, opsiWarna, type Lengan } from '@/lib/merch-harga'
import type { Bundle, DiskonRule } from '@/lib/types'

type Produk = {
  id: string
  nama: string
  gambar_url: string | null
  warna: string | null
  harga: number
  harga_po: number | null
  harga_po_panjang: number | null
  harga_po_umum: number | null
  harga_po_umum_panjang: number | null
  harga_hari_h_panjang: number | null
  po_mulai: string | null
  po_selesai: string | null
  diskon: DiskonRule[] | null
  varian_ids: string[] | null
}
type Varian = { id: string; nama: string }
type Pilihan = { varian_id: string; warna: string; lengan: string }
type Pesanan = { id: string; no_pesanan: string; total: number; t: string; items: Array<{ nama: string; qty: number }> }

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'
const TURNSTILE_ENABLED = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

export default function PaketPage() {
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [produkList, setProdukList] = useState<Produk[]>([])
  const [varianList, setVarianList] = useState<Varian[]>([])
  const [qris, setQris] = useState<Record<string, string>>({})
  const [step, setStep] = useState(1)
  const [selected, setSelected] = useState<Bundle | null>(null)
  const [pilihan, setPilihan] = useState<Record<string, Pilihan>>({})
  const [form, setForm] = useState({ nama_pembeli: '', kontak: '', email: '' })
  const [pesanan, setPesanan] = useState<Pesanan | null>(null)
  const [qr, setQr] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const turnstileRef = useRef<TurnstileHandle>(null)
  const submitting = useRef(false)

  useEffect(() => {
    Promise.all([
      getJSON<Bundle[]>('/api/public/paket'),
      getJSON<Produk[]>('/api/public/produk'),
      getJSON<{ varian?: Varian[] }>('/api/public/po/katalog'),
      getJSON<Record<string, string>>('/api/pengaturan/qris'),
    ])
      .then(([b, p, k, q]) => {
        setBundles(Array.isArray(b) ? b : [])
        setProdukList(Array.isArray(p) ? p : [])
        setVarianList(Array.isArray(k?.varian) ? k.varian : [])
        setQris(q ?? {})
      })
      .catch(() => toast.error('Gagal memuat paket'))
  }, [])

  const produkMap = useMemo(() => new Map(produkList.map((p) => [p.id, p])), [produkList])

  useEffect(() => {
    if (!file) { setPreview(''); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    if (!qris.qris_payload || !pesanan || Number(pesanan.total) <= 0) { setQr(''); return }
    QRCode.toDataURL(buatQrisDinamis(qris.qris_payload, Number(pesanan.total)), { width: 320, margin: 2, errorCorrectionLevel: 'H' })
      .then(setQr)
      .catch(() => setQr(''))
  }, [qris, pesanan])

  function pilihPaket(bundle: Bundle) {
    const init: Record<string, Pilihan> = {}
    for (const item of bundle.items ?? []) {
      if (item.tipe !== 'merch') continue
      const produk = produkMap.get(item.ref_id)
      if (!produk) continue
      const lenganOpsi = opsiLengan(produk, 'po', 'Umum')
      init[item.id] = {
        varian_id: '',
        warna: opsiWarna(produk.warna)[0] ?? '',
        lengan: lenganOpsi[0] ?? 'Pendek',
      }
    }
    setPilihan(init)
    setSelected(bundle)
    setStep(2)
  }

  function validasi() {
    if (!form.nama_pembeli.trim() || !form.kontak.trim()) {
      toast.error('Lengkapi nama dan kontak')
      return false
    }
    for (const item of selected?.items ?? []) {
      if (item.tipe !== 'merch') continue
      const produk = produkMap.get(item.ref_id)
      if (!produk) continue
      const p = pilihan[item.id]
      if ((produk.varian_ids?.length ?? 0) > 0 && !p?.varian_id) {
        toast.error(`Pilih ukuran untuk ${produk.nama}`)
        return false
      }
      if (opsiWarna(produk.warna).length > 0 && !p?.warna) {
        toast.error(`Pilih warna untuk ${produk.nama}`)
        return false
      }
      const lenganOpsi = opsiLengan(produk, 'po', 'Umum')
      if (lenganOpsi.length > 0 && (!p?.lengan || !lenganOpsi.includes(p.lengan as Lengan))) {
        toast.error(`Pilih lengan untuk ${produk.nama}`)
        return false
      }
    }
    return true
  }

  async function pesan() {
    if (submitting.current || !selected) return
    if (!validasi()) return
    submitting.current = true
    try {
      let token = turnstileRef.current?.getToken() ?? null
      if (TURNSTILE_ENABLED && !token) {
        const id = toast.loading('Menunggu verifikasi Cloudflare.')
        try { token = await turnstileRef.current?.waitForToken() ?? null } finally { toast.dismiss(id) }
        if (!token) { toast.error('Verifikasi Cloudflare belum selesai. Coba lagi.'); return }
      }
      const res = await fetch('/api/public/paket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundle_id: selected.id,
          ...form,
          turnstile_token: token,
          merch: (selected.items ?? [])
            .filter((i) => i.tipe === 'merch')
            .map((i) => ({ bundle_item_id: i.id, ...(pilihan[i.id] ?? {}) })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal membuat pesanan')
      setPesanan(data)
      setStep(3)
      toast.success('Pesanan paket dibuat, silakan bayar')
    } catch (e) {
      turnstileRef.current?.reset()
      toast.error((e as Error).message)
    } finally {
      submitting.current = false
    }
  }

  function pilihFile(next: File | null) {
    if (!next) { setFile(null); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) {
      toast.error('Format bukti harus JPG, PNG, atau WebP')
      return
    }
    if (next.size > 5 * 1024 * 1024) { toast.error('Ukuran bukti maksimal 5MB'); return }
    setFile(next)
  }

  async function upload() {
    if (!file || !pesanan) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'bukti-po')
      const up = await fetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json())
      if (!up.url) throw new Error(up.error || 'Upload gagal')
      const res = await fetch('/api/public/paket/bukti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kode: pesanan.no_pesanan, t: pesanan.t, bukti_url: up.url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim bukti')
      toast.success('Bukti terkirim, menunggu verifikasi')
      setStep(4)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <PublicNavbar title="Paket Combo" maxWidth="max-w-7xl" />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 pb-28 sm:px-6">
        <PoStepper
          steps={[{ label: 'Pilih Paket' }, { label: 'Form Pemesan' }, { label: 'Pembayaran' }, { label: 'Selesai' }]}
          currentStep={step}
        />

        {step === 1 && (
          <>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Paket Combo</h1>
              <p className="text-sm text-slate-500">Dapatkan tiket dan merchandise sekaligus, bayar sekali.</p>
            </div>
            <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {bundles.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
                  Belum ada paket yang dibuka.
                </div>
              )}
              {bundles.map((b) => {
                const komponen = (b.items ?? []).reduce((s, i) => s + Number(i.harga_satuan ?? 0) * Number(i.qty), 0)
                return (
                  <div key={b.id} className="flex h-full flex-col rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm sm:p-4">
                    <div className="mb-3 aspect-square shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {b.gambar_url ? (
                        <img src={b.gambar_url} alt={b.nama} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center"><Package className="h-8 w-8 text-slate-300" /></div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col">
                      <h2 className="line-clamp-2 min-h-[2.5rem] font-medium text-slate-900">{b.nama}</h2>
                      <div className="mt-1 min-h-[2rem]">
                        {b.deskripsi ? <p className="line-clamp-2 text-xs text-slate-500">{b.deskripsi}</p> : null}
                      </div>
                      <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                        {(b.items ?? []).map((i) => (
                          <li key={i.id} className="line-clamp-1">{i.qty}× {i.nama} <span className="text-slate-400">({i.tipe === 'tiket' ? 'Tiket' : 'Merch'})</span></li>
                        ))}
                      </ul>
                      <div className="mt-auto flex flex-col gap-2 pt-3 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-violet-600">{formatRupiah(Number(b.harga_bundle))}</p>
                          {komponen > 0 && <p className="text-[11px] text-slate-400 line-through">{formatRupiah(komponen)}</p>}
                        </div>
                        <button onClick={() => pilihPaket(b)} className="flex w-full shrink-0 items-center justify-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 sm:w-auto">
                          Pilih Paket
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {step === 2 && selected && (
          <div className="max-w-6xl space-y-4">
            <button onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:underline">
              <ChevronLeft className="h-4 w-4" /> Pilih paket lain
            </button>
            <h1 className="text-2xl font-semibold text-slate-900">Form Pemesan</h1>

            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
                <h2 className="font-medium text-slate-900">Data Pemesan</h2>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Nama</label>
                    <input value={form.nama_pembeli} onChange={(e) => setForm((f) => ({ ...f, nama_pembeli: e.target.value }))} className={input} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Kontak (WA)</label>
                    <input value={form.kontak} onChange={(e) => setForm((f) => ({ ...f, kontak: e.target.value }))} className={input} placeholder="08xxxxxxxxxx" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Email (opsional)</label>
                    <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={input} />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
                <h2 className="font-medium text-slate-900">{selected.nama}</h2>
                <p className="text-sm text-slate-500">{formatRupiah(Number(selected.harga_bundle))}</p>
                <div className="mt-4 space-y-3">
                  {(selected.items ?? []).map((item) => {
                    if (item.tipe === 'tiket') {
                      return (
                        <div key={item.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                          {item.qty}× {item.nama} <span className="text-xs text-slate-400">(Tiket)</span>
                        </div>
                      )
                    }
                    const produk = produkMap.get(item.ref_id)
                    if (!produk) {
                      return <div key={item.id} className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">{item.qty}× {item.nama} (pre-order belum tersedia)</div>
                    }
                    const varianProduk = varianList.filter((v) => produk.varian_ids?.includes(v.id))
                    const warnaOpsi = opsiWarna(produk.warna)
                    const lenganOpsi = opsiLengan(produk, 'po', 'Umum')
                    const p = pilihan[item.id] ?? { varian_id: '', warna: '', lengan: '' }
                    return (
                      <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center gap-3">
                          {produk.gambar_url && <img src={produk.gambar_url} alt={produk.nama} className="h-12 w-12 rounded-lg object-cover" />}
                          <p className="text-sm font-medium text-slate-900">{item.qty}× {produk.nama}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {warnaOpsi.length > 0 && (
                            <select aria-label="Warna" value={p.warna} onChange={(e) => setPilihan((s) => ({ ...s, [item.id]: { ...p, warna: e.target.value } }))} className="min-w-[110px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                              <option value="">Pilih warna</option>
                              {warnaOpsi.map((w) => <option key={w} value={w}>{w}</option>)}
                            </select>
                          )}
                          {lenganOpsi.length > 0 && (
                            <select aria-label="Lengan" value={p.lengan} onChange={(e) => setPilihan((s) => ({ ...s, [item.id]: { ...p, lengan: e.target.value } }))} className="min-w-[110px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                              <option value="">Pilih lengan</option>
                              {lenganOpsi.map((l) => <option key={l} value={l}>{l}</option>)}
                            </select>
                          )}
                          {varianProduk.length > 0 && (
                            <select aria-label="Ukuran" value={p.varian_id} onChange={(e) => setPilihan((s) => ({ ...s, [item.id]: { ...p, varian_id: e.target.value } }))} className="min-w-[110px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                              <option value="">Pilih ukuran</option>
                              {varianProduk.map((v) => <option key={v.id} value={v.id}>{v.nama}</option>)}
                            </select>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 flex justify-between border-t border-slate-100 pt-3 text-sm">
                  <span className="text-slate-500">Total</span>
                  <span className="font-semibold text-slate-900">{formatRupiah(Number(selected.harga_bundle))}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={pesan} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-700">
                Lanjut ke Pembayaran
              </button>
            </div>

            {TURNSTILE_ENABLED && (
              <div className="hidden"><Turnstile ref={turnstileRef} /></div>
            )}
          </div>
        )}

        {step === 3 && pesanan && (
          <div className="max-w-4xl space-y-4">
            <h1 className="text-2xl font-semibold text-slate-900">Pembayaran</h1>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Detail Pesanan</h2>
                <p className="text-sm"><span className="text-slate-500">No. Pesanan</span> : {pesanan.no_pesanan}</p>
                <div className="mt-2 space-y-1">
                  {pesanan.items.map((it, i) => (
                    <p key={i} className="text-sm">
                      <span className="text-slate-500">{it.nama}</span> × {it.qty}
                    </p>
                  ))}
                </div>
                <p className="text-sm"><span className="text-slate-500">Nama</span> : {form.nama_pembeli}</p>
                <p className="text-sm"><span className="text-slate-500">Kontak</span> : {form.kontak}</p>
                <p className="text-sm"><span className="text-slate-500">Total</span> : {formatRupiah(Number(pesanan.total))}</p>
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-6 text-center shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Scan QRIS</h2>
                <div className="mx-auto w-fit rounded-2xl border-4 border-violet-500 bg-white p-3 shadow-lg shadow-violet-100">
                  {qr ? (
                    <img src={qr} alt="QRIS" className="h-72 w-72 rounded-lg object-contain" />
                  ) : (
                    <div className="flex h-72 w-72 items-center justify-center text-xs text-slate-400">Memuat QRIS...</div>
                  )}
                </div>
                <p className="text-sm text-slate-500">Nominal QRIS otomatis {formatRupiah(Number(pesanan.total))}.</p>
                <div className="space-y-3 text-left">
                  <label className="block text-sm font-medium text-slate-700">Bukti pembayaran</label>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pilihFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-violet-700 hover:file:bg-violet-100" />
                  <p className="text-xs text-slate-500">JPG, PNG, atau WebP. Maksimal 5MB.</p>
                  {preview && <img src={preview} alt="Pratinjau" className="max-h-56 w-full rounded-xl object-contain" />}
                  <button onClick={upload} disabled={uploading || !file} className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                    {uploading ? 'Mengupload...' : 'Upload Bukti Bayar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && pesanan && (
          <div className="mx-auto w-full max-w-4xl space-y-4 rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h1 className="text-xl font-semibold text-slate-900">Bukti terkirim</h1>
            <p className="text-sm text-slate-500">Pesanan {pesanan.no_pesanan} menunggu verifikasi admin. Pantau status lewat halaman lacak.</p>
            <Link href={`/lacak/${pesanan.no_pesanan}?t=${encodeURIComponent(pesanan.t)}`} className="inline-flex rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-700">
              Lacak Pesanan
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
