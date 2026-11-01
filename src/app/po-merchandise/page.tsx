'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { ArrowLeft, Shirt } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { buatQrisDinamis } from '@/lib/qris'

type Pengurus = { id: string; nama: string; divisi: string | null; kontak: string | null }
type Varian = { id: string; nama: string }
type Katalog = { pengurus: Pengurus[]; varian: Varian[]; harga: number }

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10'

export default function PoMerchandisePage() {
  const [katalog, setKatalog] = useState<Katalog>({ pengurus: [], varian: [], harga: 75000 })
  const [qris, setQris] = useState<Record<string, string>>({})
  const [qr, setQr] = useState('')
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    tipe_pemesan: 'Pengurus Himpunan' as 'Pengurus Himpunan' | 'Umum',
    pengurus_id: '',
    nama_pengurus: '',
    nama_pemesan: '',
    kontak: '',
    email: '',
    varian_id: '',
    qty: 1,
  })
  const [pesanan, setPesanan] = useState<{ id: string; no_po: string; total: number; t: string } | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/public/po/katalog').then((r) => r.json()),
      fetch('/api/pengaturan/qris').then((r) => r.json()),
    ]).then(([k, q]) => {
      setKatalog(k)
      setQris(q)
      if (k.varian?.[0]) setForm((f) => ({ ...f, varian_id: k.varian[0].id }))
    }).catch(() => toast.error('Gagal memuat katalog PO'))
  }, [])

  const total = useMemo(() => Number(katalog.harga) * Number(form.qty), [katalog.harga, form.qty])

  useEffect(() => {
    if (!qris.qris_payload || !total) {
      setQr('')
      return
    }
    QRCode.toDataURL(buatQrisDinamis(qris.qris_payload, total), { width: 320, margin: 2, errorCorrectionLevel: 'H' })
      .then(setQr)
      .catch(() => setQr(''))
  }, [qris, total])

  function pilihPengurus(nama: string) {
    const found = katalog.pengurus.find((p) => p.nama === nama)
    setForm({
      ...form,
      nama_pengurus: nama,
      pengurus_id: found?.id ?? '',
      nama_pemesan: found?.nama ?? '',
      kontak: found?.kontak ?? form.kontak,
    })
  }

  async function pesan() {
    if (form.tipe_pemesan === 'Pengurus Himpunan' && !form.pengurus_id) {
      return toast.error('Pilih nama pengurus dari daftar')
    }
    if (!form.nama_pemesan.trim() || !form.kontak.trim() || !form.varian_id) {
      return toast.error('Lengkapi nama, kontak, dan ukuran')
    }
    try {
      const res = await fetch('/api/public/po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, qty: Number(form.qty) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal membuat pesanan')
      setPesanan(data)
      setStep(2)
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
      setStep(3)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <header className="border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
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

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {step === 1 && (
          <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-6">
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-violet-600/10 text-violet-600">
                <Shirt className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-semibold text-slate-900">Pre-Order Baju Dies Natalis</h1>
              <p className="text-sm text-slate-500">Harga {formatRupiah(katalog.harga)} per item.</p>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Kategori Pemesan</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(['Pengurus Himpunan', 'Umum'] as const).map((tipe) => (
                    <button
                      key={tipe}
                      type="button"
                      onClick={() => setForm({ ...form, tipe_pemesan: tipe, pengurus_id: '', nama_pengurus: '', nama_pemesan: tipe === 'Umum' ? '' : form.nama_pemesan })}
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
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Nama Pengurus</label>
                  <input
                    list="pengurus-list"
                    className={input}
                    placeholder="Cari nama pengurus..."
                    value={form.nama_pengurus}
                    onChange={(e) => pilihPengurus(e.target.value)}
                  />
                  <datalist id="pengurus-list">
                    {katalog.pengurus.map((p) => (
                      <option key={p.id} value={p.nama}>{p.divisi || ''}</option>
                    ))}
                  </datalist>
                  {katalog.pengurus.length === 0 && <p className="mt-1 text-xs text-red-600">Belum ada data pengurus. Hubungi admin.</p>}
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Nama Pemesan</label>
                  <input className={input} value={form.nama_pemesan} onChange={(e) => setForm({ ...form, nama_pemesan: e.target.value })} />
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Kontak WA</label>
                  <input className={input} value={form.kontak} onChange={(e) => setForm({ ...form, kontak: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Email (opsional)</label>
                  <input className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Ukuran</label>
                  <select className={input} value={form.varian_id} onChange={(e) => setForm({ ...form, varian_id: e.target.value })}>
                    {katalog.varian.map((v) => <option key={v.id} value={v.id}>{v.nama}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Jumlah</label>
                  <input type="number" min={1} max={20} className={input} value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Total Pembayaran</p>
                <p className="text-lg font-semibold text-violet-600">{formatRupiah(total)}</p>
              </div>

              <div className="flex justify-end">
                <button onClick={pesan} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white">
                  Buat Pesanan
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && pesanan && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Detail Pesanan</h2>
              <p className="text-sm"><span className="text-slate-500">No. PO</span> : {pesanan.no_po}</p>
              <p className="text-sm"><span className="text-slate-500">Nama</span> : {form.nama_pemesan}</p>
              <p className="text-sm"><span className="text-slate-500">Jumlah</span> : {form.qty}</p>
              <p className="text-sm"><span className="text-slate-500">Total</span> : {formatRupiah(Number(pesanan.total))}</p>
            </div>
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
          </div>
        )}

        {step === 3 && pesanan && (
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
