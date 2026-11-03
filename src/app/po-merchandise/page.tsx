'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { ArrowLeft, Check, ChevronDown, Shirt, Trash2, Plus, Minus } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { buatQrisDinamis } from '@/lib/qris'
import { hitungDiskon } from '@/lib/merch-diskon'
import type { DiskonRule } from '@/lib/types'

type Pengurus = { id: string; nama: string; divisi: string | null; kontak: string | null }
type Varian = { id: string; nama: string }
type Produk = {
  id: string
  nama: string
  deskripsi: string | null
  gambar_url: string | null
  warna: string | null
  harga: number
  harga_po: number | null
  diskon: DiskonRule[] | null
  varian_ids: string[] | null
}
type ItemKeranjang = {
  produk: Produk
  qty: number
  varian?: Varian
}
type Pesanan = {
  id: string
  no_po: string
  total: number
  t: string
  items: Array<{ produk: { nama: string; gambar_url: string | null }; qty: number; varian?: { nama: string } | null }>
}

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'

export default function PoMerchandisePage() {
  const [produkList, setProdukList] = useState<Produk[]>([])
  const [pengurus, setPengurus] = useState<Pengurus[]>([])
  const [varianList, setVarianList] = useState<Varian[]>([])
  const [qris, setQris] = useState<Record<string, string>>({})
  const [qr, setQr] = useState('')
  const [step, setStep] = useState(1)
  const [keranjang, setKeranjang] = useState<ItemKeranjang[]>([])
  const [form, setForm] = useState({
    tipe_pemesan: 'Pengurus Himpunan' as 'Pengurus Himpunan' | 'Umum',
    pengurus_id: '',
    nama_pengurus: '',
    nama_pemesan: '',
    kontak: '',
    email: '',
    pembayaran_metode: 'QRIS' as 'QRIS' | 'Cash',
    pembayaran_tipe: 'lunas' as 'lunas' | 'nyicil',
  })
  const [pesanan, setPesanan] = useState<Pesanan | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pengurusOpen, setPengurusOpen] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/public/produk').then((r) => r.json()),
      fetch('/api/public/po/katalog').then((r) => r.json()),
      fetch('/api/pengaturan/qris').then((r) => r.json()),
    ]).then(([produk, k, q]) => {
      setProdukList(produk ?? [])
      setPengurus(k.pengurus ?? [])
      setVarianList(k.varian ?? [])
      setQris(q)
    }).catch(() => toast.error('Gagal memuat katalog'))
  }, [])

  const totalKeranjang = useMemo(() => keranjang.reduce((s, item) => s + hitungDiskon(item.qty, Number(item.produk.harga_po), item.produk.diskon, 'po').total, 0), [keranjang])
  const totalDiskon = useMemo(() => keranjang.reduce((s, item) => s + hitungDiskon(item.qty, Number(item.produk.harga_po), item.produk.diskon, 'po').diskon, 0), [keranjang])
  const totalQty = useMemo(() => keranjang.reduce((s, item) => s + item.qty, 0), [keranjang])
  const pengurusTersaring = useMemo(() => {
    const q = form.nama_pengurus.trim().toLowerCase()
    if (!q) return pengurus
    return pengurus.filter((p) =>
      p.nama.toLowerCase().includes(q) || (p.divisi ?? '').toLowerCase().includes(q)
    )
  }, [pengurus, form.nama_pengurus])

  useEffect(() => {
    if (!qris.qris_payload || !totalKeranjang) {
      setQr('')
      return
    }
    QRCode.toDataURL(buatQrisDinamis(qris.qris_payload, totalKeranjang), { width: 320, margin: 2, errorCorrectionLevel: 'H' })
      .then(setQr)
      .catch(() => setQr(''))
  }, [qris, totalKeranjang])

  function tambahKeKeranjang(produk: Produk) {
    if (!produk.harga_po) {
      return toast.error('Produk ini belum dibuka pre-order')
    }
    setKeranjang((prev) => {
      const found = prev.find((i) => i.produk.id === produk.id)
      if (found) {
        return prev.map((i) => i.produk.id === produk.id ? { ...i, qty: Math.min(20, i.qty + 1) } : i)
      }
      return [...prev, { produk, qty: 1 }]
    })
    toast.success('Ditambahkan ke keranjang')
  }

  function updateQty(idx: number, qty: number) {
    const clamped = Math.max(1, Math.min(20, qty))
    setKeranjang((prev) => prev.map((i, n) => n === idx ? { ...i, qty: clamped } : i))
  }

  function hapusDariKeranjang(idx: number) {
    setKeranjang((prev) => prev.filter((_, n) => n !== idx))
  }

  function pilihVarian(idx: number, id: string) {
    const v = varianList.find((x) => x.id === id)
    setKeranjang((prev) => prev.map((i, n) => n === idx ? { ...i, varian: v } : i))
  }

  function validasiPemesan() {
    if (keranjang.length === 0) {
      toast.error('Keranjang kosong')
      return false
    }
    const belumUkuran = keranjang.find((item) => (item.produk.varian_ids?.length ?? 0) > 0 && !item.varian)
    if (belumUkuran) {
      toast.error(`Pilih ukuran untuk ${belumUkuran.produk.nama}`)
      return false
    }
    if (form.tipe_pemesan === 'Pengurus Himpunan' && !form.pengurus_id) {
      toast.error('Pilih nama pengurus dari daftar')
      return false
    }
    if (!form.nama_pemesan.trim() || !form.kontak.trim()) {
      toast.error('Lengkapi nama dan kontak')
      return false
    }
    return true
  }

  function lanjutPembayaran() {
    if (validasiPemesan()) setStep(3)
  }

  function pilihPengurus(p: Pengurus) {
    setForm({
      ...form,
      nama_pengurus: p.nama,
      pengurus_id: p.id,
      nama_pemesan: p.nama,
      kontak: p.kontak ?? form.kontak,
    })
  }

  async function pesan() {
    if (!validasiPemesan()) return
    try {
      const res = await fetch('/api/public/po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          items: keranjang.map((item) => ({
            merchandise_id: item.produk.id,
            varian_id: item.varian?.id ?? null,
            qty: item.qty,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal membuat pesanan')
      setPesanan(data)
      setStep(4)
      toast.success('Pesanan PO dibuat, silakan bayar')
    } catch (e) {
      toast.error((e as Error).message)
    }
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

      const res = await fetch('/api/public/status/bukti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kode: pesanan.no_po, t: pesanan.t, bukti_url: up.url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim bukti')
      toast.success('Bukti terkirim, menunggu verifikasi')
      setStep(5)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <header className="border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-600 text-sm font-semibold text-white">DU</span>
            <div>
              <p className="text-sm font-semibold text-slate-900">PO Merchandise</p>
              <p className="text-xs text-slate-500">Dies Natalis HMTI</p>
            </div>
          </Link>
          <Link href="/" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 pb-28">
        {step === 1 && (
          <>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Katalog Merchandise</h1>
              <p className="text-sm text-slate-500">Pilih produk yang ingin dipesan.</p>
            </div>
            <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {produkList.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
                  Belum ada produk.
                </div>
              )}
              {produkList.map((item) => (
                <div key={item.id} className="flex h-full flex-col rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  <div className="mb-3 aspect-square shrink-0 overflow-hidden rounded-xl bg-slate-100">
                    {item.gambar_url ? (
                      <img src={item.gambar_url} alt={item.nama} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Shirt className="h-8 w-8 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <h2 className="line-clamp-2 min-h-[2.5rem] font-medium text-slate-900">{item.nama}</h2>
                    <div className="mt-1 min-h-[2rem]">
                      {item.deskripsi ? (
                        <p className="line-clamp-2 text-xs text-slate-500">{item.deskripsi}</p>
                      ) : null}
                    </div>
                    <div className="min-h-[1.25rem] text-sm text-slate-500">
                      {item.warna ? `Warna: ${item.warna}` : ''}
                    </div>
                    <div className="mt-1 min-h-[2.5rem]">
                      {Number(item.harga) > 0 ? (
                        <div className="text-sm text-slate-500">Harga Hari H: {formatRupiah(Number(item.harga))}</div>
                      ) : (
                        <div className="text-xs text-slate-500">Produk ini hanya untuk pre-order, tidak dijual saat Hari H.</div>
                      )}
                    </div>
                    <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                      <span className="text-sm font-semibold text-violet-600">
                        {item.harga_po ? formatRupiah(Number(item.harga_po)) : 'Pre-order belum dibuka'}
                      </span>
                      <button
                        onClick={() => tambahKeKeranjang(item)}
                        disabled={!item.harga_po}
                        className="flex shrink-0 items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" /> Tambah
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 1 && keranjang.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-xl">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="text-xs text-slate-500">{totalQty} item dipilih</p>
                <p className="text-lg font-semibold text-violet-600">{formatRupiah(totalKeranjang)}</p>
              </div>
              <button onClick={() => setStep(2)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700">
                Lanjutkan ke Pengisian Form Pemesan
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-slate-900">Form Pemesan</h1>
              <button onClick={() => setStep(1)} className="text-sm text-slate-600 hover:underline">
                Kembali ke Katalog
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-slate-900">Produk Dipilih</h2>
                <span className="text-sm text-slate-500">{totalQty} item</span>
              </div>
              {keranjang.length === 0 ? (
                <p className="mt-4 text-center text-sm text-slate-500">Keranjang masih kosong.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {keranjang.map((item, idx) => {
                    const hitung = hitungDiskon(item.qty, Number(item.produk.harga_po), item.produk.diskon, 'po')
                    const varianProduk = varianList.filter((v) => item.produk.varian_ids?.includes(v.id))
                    return (
                      <div key={idx} className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100">
                          {item.produk.gambar_url ? (
                            <img src={item.produk.gambar_url} alt={item.produk.nama} className="h-full w-full object-cover" />
                          ) : (
                            <Shirt className="h-5 w-5 text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900">{item.produk.nama}</p>
                          {varianProduk.length > 0 ? (
                            <select
                              className="mt-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                              value={item.varian?.id ?? ''}
                              onChange={(e) => pilihVarian(idx, e.target.value)}
                            >
                              <option value="">Pilih ukuran</option>
                              {varianProduk.map((v) => (
                                <option key={v.id} value={v.id}>{v.nama}</option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-xs text-slate-500">{item.varian?.nama || 'Tanpa ukuran'}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => updateQty(idx, item.qty - 1)} className="rounded-lg border p-1 hover:bg-slate-50"><Minus className="h-3.5 w-3.5" /></button>
                          <span className="w-7 text-center text-sm">{item.qty}</span>
                          <button onClick={() => updateQty(idx, item.qty + 1)} className="rounded-lg border p-1 hover:bg-slate-50"><Plus className="h-3.5 w-3.5" /></button>
                        </div>
                        <div className="min-w-24 text-right">
                          <div className="text-sm font-semibold text-violet-600">{formatRupiah(hitung.total)}</div>
                          {hitung.diskon > 0 && <div className="text-[11px] text-green-600">Diskon -{formatRupiah(hitung.diskon)}</div>}
                        </div>
                        <button onClick={() => hapusDariKeranjang(idx)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm text-slate-500">Total Pembayaran</span>
                    <div className="text-right">
                      {totalDiskon > 0 && <div className="text-xs text-green-600">Hemat {formatRupiah(totalDiskon)}</div>}
                      <span className="font-semibold text-violet-600">{formatRupiah(totalKeranjang)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">Kategori Pemesan</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(['Pengurus Himpunan', 'Umum'] as const).map((tipe) => (
                    <button
                      key={tipe}
                      type="button"
                      onClick={() => {
                        setPengurusOpen(false)
                        setForm({ ...form, tipe_pemesan: tipe, pengurus_id: '', nama_pengurus: '', nama_pemesan: tipe === 'Umum' ? '' : form.nama_pemesan })
                      }}
                      className={`rounded-xl border p-3 text-left text-sm ${form.tipe_pemesan === tipe ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-500/10' : 'border-slate-200'}`}
                    >
                      <span className="font-medium text-slate-900">{tipe}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {tipe === 'Pengurus Himpunan' ? 'Pilih nama dari daftar pengurus' : 'Isi nama sendiri'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {form.tipe_pemesan === 'Pengurus Himpunan' ? (
                <div className="mb-4">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Nama Pengurus</label>
                  <div
                    className="relative"
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPengurusOpen(false)
                    }}
                  >
                    <input
                      className={`${input} pr-10`}
                      placeholder="Cari nama atau divisi pengurus..."
                      value={form.nama_pengurus}
                      onChange={(e) => {
                        setForm({ ...form, nama_pengurus: e.target.value, pengurus_id: '' })
                        setPengurusOpen(true)
                      }}
                      onFocus={() => setPengurusOpen(true)}
                      autoComplete="off"
                    />
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    {pengurusOpen && (
                      <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                        {pengurusTersaring.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-slate-500">Pengurus tidak ditemukan.</p>
                        ) : (
                          pengurusTersaring.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                pilihPengurus(p)
                                setPengurusOpen(false)
                              }}
                              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-violet-50 ${
                                form.pengurus_id === p.id ? 'bg-violet-50' : ''
                              }`}
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-slate-900">{p.nama}</span>
                                {p.divisi && <span className="block truncate text-xs text-slate-500">{p.divisi}</span>}
                              </span>
                              {form.pengurus_id === p.id && <Check className="h-4 w-4 shrink-0 text-violet-600" />}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {pengurus.length === 0 && <p className="mt-1 text-xs text-red-600">Belum ada data pengurus. Hubungi admin.</p>}
                </div>
              ) : (
                <div className="mb-4">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Nama Pemesan</label>
                  <input className={input} placeholder="Nama lengkap" value={form.nama_pemesan} onChange={(e) => setForm({ ...form, nama_pemesan: e.target.value })} />
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Kontak WA</label>
                  <input
                    className={input}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="08xxxxxxxxxx"
                    value={form.kontak}
                    onChange={(e) => setForm({ ...form, kontak: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Email (opsional)</label>
                  <input className={input} placeholder="nama@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={lanjutPembayaran} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white">
                Lanjut ke Pembayaran
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-slate-900">Pembayaran</h1>
              <button onClick={() => setStep(2)} className="text-sm text-slate-600 hover:underline">
                Kembali ke Form Pemesan
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Metode Pembayaran</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(['QRIS', 'Cash'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setForm({ ...form, pembayaran_metode: m })}
                        className={`rounded-xl border p-3 text-left text-sm ${form.pembayaran_metode === m ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-500/10' : 'border-slate-200'}`}
                      >
                        <span className="font-medium text-slate-900">{m}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Tipe Pembayaran</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(['lunas', 'nyicil'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm({ ...form, pembayaran_tipe: t })}
                        className={`rounded-xl border p-3 text-left text-sm ${form.pembayaran_tipe === t ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-500/10' : 'border-slate-200'}`}
                      >
                        <span className="font-medium text-slate-900">{t === 'lunas' ? 'Lunas' : 'Nyicil (DP)'}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{t === 'lunas' ? 'Bayar penuh sekarang' : 'Bayar DP terlebih dahulu'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-4">
                <span className="text-sm text-slate-500">Total Pembayaran</span>
                <div className="text-right">
                  {totalDiskon > 0 && <div className="text-xs text-green-600">Hemat {formatRupiah(totalDiskon)}</div>}
                  <span className="text-lg font-semibold text-violet-600">{formatRupiah(totalKeranjang)}</span>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button onClick={pesan} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white">
                  Buat Pesanan
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && pesanan && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Detail Pesanan</h2>
              <p className="text-sm"><span className="text-slate-500">No. PO</span> : {pesanan.no_po}</p>
              <div className="mt-2 space-y-1">
                {pesanan.items.map((it, i) => (
                  <p key={i} className="text-sm">
                    <span className="text-slate-500">{it.produk.nama}</span> {it.varian?.nama ? `(${it.varian.nama})` : ''} × {it.qty}
                  </p>
                ))}
              </div>
              <p className="text-sm"><span className="text-slate-500">Nama</span> : {form.nama_pemesan}</p>
              <p className="text-sm"><span className="text-slate-500">Total</span> : {formatRupiah(Number(pesanan.total))}</p>
              <p className="text-sm"><span className="text-slate-500">Pembayaran</span> : {form.pembayaran_metode} {form.pembayaran_tipe}</p>
            </div>
            {form.pembayaran_metode === 'QRIS' && (
              <div className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-6 text-center shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Scan QRIS</h2>
                <div className="mx-auto w-fit rounded-2xl border border-slate-200 bg-white p-3">
                  {qr ? <img src={qr} alt="QRIS" className="h-72 w-72 rounded-lg" /> : <div className="h-72 w-72 animate-pulse rounded-lg bg-slate-100" />}
                </div>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
                <button onClick={upload} disabled={uploading || !file} className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                  {uploading ? 'Mengupload...' : 'Upload Bukti Bayar'}
                </button>
              </div>
            )}
            {form.pembayaran_metode === 'Cash' && (
              <div className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-6 text-center shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Pembayaran Cash</h2>
                <p className="text-sm text-slate-500">Serahkan bukti pembayaran tunai ke panitia. Simpan link ini untuk memantau status.</p>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
                <button onClick={upload} disabled={uploading || !file} className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                  {uploading ? 'Mengupload...' : 'Upload Bukti Bayar'}
                </button>
              </div>
            )}
          </div>
        )}

        {step === 5 && pesanan && (
          <div className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Menunggu Verifikasi</h2>
            <p className="text-slate-500">Bukti pembayaran sudah dikirim. Simpan link berikut untuk melihat status dan QR pengambilan.</p>
            <Link href={`/lacak/${pesanan.no_po}?t=${encodeURIComponent(pesanan.t)}`} className="inline-flex rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white">
              Buka Riwayat PO
            </Link>
            <p className="text-xs text-slate-400">No. PO: {pesanan.no_po}</p>
          </div>
        )}
      </main>
    </div>
  )
}
