'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '@/app/dankelola/api'
import { formatRupiah } from '@/lib/utils'
import type { TicketKatalogItem } from '@/lib/types'
import QRCode from 'qrcode'

export default function BeliTiketPublik() {
  const [katalog, setKatalog] = useState<{ tiket: TicketKatalogItem[]; varian: Array<Record<string, unknown>> }>({ tiket: [], varian: [] })
  const [qris, setQris] = useState<Record<string, string>>({})
  const [form, setForm] = useState({ tiket_tipe_id: '', nama_pembeli: '', kontak: '', email: '', jumlah: 1 })
  const [pesanan, setPesanan] = useState<{ id: string; no_pesanan?: string; nama_pembeli?: string; jumlah?: number; total?: number; t?: string } | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [qr, setQr] = useState('')
  const [step, setStep] = useState(1)

  useEffect(() => {
    Promise.all([getJSON<{ tiket: TicketKatalogItem[]; varian: Array<Record<string, unknown>> }>('/api/public/katalog'), getJSON<Record<string, string>>('/api/pengaturan/qris')]).then(([k,q])=>{setKatalog({ tiket: k.tiket || [], varian: k.varian || [] }); setQris(q)})
  }, [])
  useEffect(() => { if (qris.qris_payload) QRCode.toDataURL(qris.qris_payload,{width:320,margin:2,errorCorrectionLevel:'H'}).then(setQr).catch(()=>{}) }, [qris])

  const tipe = katalog.tiket.find((t)=>t.id===form.tiket_tipe_id)
  const total = tipe ? Number(tipe.harga_aktif) * Number(form.jumlah) : 0

  async function beli() {
    if (!tipe) { toast.error('Pilih tipe tiket'); return }
    if (!tipe.buka) { toast.error('Tiket sedang ditutup atau sudah habis'); return }
    if (tipe.sisa !== null && Number(form.jumlah) > tipe.sisa) {
      toast.error(`Sisa tiket ${tipe.sisa}`)
      return
    }
    try {
      const res = await sendJSON('/api/public/tiket', 'POST', { ...form, jumlah: Number(form.jumlah) })
      setPesanan(res as { id: string; no_pesanan?: string; nama_pembeli?: string; jumlah?: number; total?: number; t?: string })
      setStep(2)
      toast.success('Pesanan dibuat, silakan bayar')
    } catch(e: unknown){ toast.error((e as Error).message) }
  }

  async function upload() {
    if (!file || !pesanan) return
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file',file); fd.append('folder','bukti-tiket')
      const up = await fetch('/api/upload',{method:'POST',body:fd}).then(r=>r.json())
      await sendJSON(`/api/public/tiket/${pesanan.id}/bukti`,'POST',{bukti_url:up.url})
      toast.success('Bukti terkirim, menunggu verifikasi')
      setStep(3)
    } catch(e: unknown){ toast.error((e as Error).message) } finally { setUploading(false) }
  }

  const input='w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <header className="border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-600 text-sm font-semibold text-white">DU</span>
            <div><p className="text-sm font-semibold text-slate-900">Beli Tiket</p><p className="text-xs text-slate-500">Dies Natalis HMTI</p></div>
          </Link>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">Kembali</Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {step===1 && (
          <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
            <div className="p-6 border-b border-slate-100"><h1 className="text-xl font-semibold text-slate-900">Pilih Tiket</h1><p className="text-sm text-slate-500">Pilih tipe tiket yang tersedia</p></div>
            <div className="p-6 grid md:grid-cols-2 gap-4">
              {katalog.tiket.map((t)=>(
                <button key={t.id} disabled={!t.buka} onClick={()=>setForm({...form,tiket_tipe_id:t.id})} className={`text-left rounded-2xl border p-5 transition-all disabled:cursor-not-allowed disabled:opacity-60 ${form.tiket_tipe_id===t.id?'border-primary-500 ring-2 ring-primary-500/10':'border-slate-200/70 hover:border-primary-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{t.nama}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${t.buka ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{t.buka ? (t.is_hari_h ? 'Hari H' : 'Dibuka') : 'Ditutup'}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{t.jumlah_orang} orang</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{t.deskripsi||'-'}</p>
                      {t.periode_aktif && <p className="mt-1 text-xs text-slate-400">Periode {t.periode_aktif.nama || 'aktif'}</p>}
                      {t.is_hari_h && t.sisa !== null && <p className="mt-1 text-xs text-orange-600">Sisa {t.sisa} tiket</p>}
                    </div>
                    <p className="font-semibold text-primary-600">{formatRupiah(t.harga_aktif)}</p>
                  </div>
                </button>
              ))}
              {katalog.tiket.length===0 && <p className="text-slate-400">Belum ada tiket yang aktif.</p>}
            </div>
            {form.tiket_tipe_id && tipe && (
              <div className="p-6 border-t border-slate-100 grid md:grid-cols-2 gap-4">
                <div><label className="mb-1 block text-sm font-medium">Nama Pembeli</label><input className={input} value={form.nama_pembeli} onChange={e=>setForm({...form,nama_pembeli:e.target.value})}/></div>
                <div><label className="mb-1 block text-sm font-medium">Kontak WA</label><input className={input} value={form.kontak} onChange={e=>setForm({...form,kontak:e.target.value})}/></div>
                <div><label className="mb-1 block text-sm font-medium">Email (opsional)</label><input className={input} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Jumlah Tiket</label>
                  <input type="number" min={1} max={tipe.is_hari_h && tipe.sisa !== null ? tipe.sisa : undefined} className={input} value={form.jumlah} onChange={e=>setForm({...form,jumlah:Math.max(1,Number(e.target.value))})}/>
                  <p className="mt-1 text-xs text-slate-500">Berlaku untuk {Number(form.jumlah) * Number(tipe.jumlah_orang)} orang</p>
                </div>
                <div className="md:col-span-2 flex items-center justify-between rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Total Pembayaran</p>
                  <p className="text-lg font-semibold text-primary-600">{formatRupiah(total)}</p>
                </div>
                <div className="md:col-span-2 flex justify-end"><button onClick={beli} disabled={!form.nama_pembeli||!form.kontak||!tipe.buka} className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">{tipe.buka ? 'Buat Pesanan' : 'Tiket Ditutup'}</button></div>
              </div>
            )}
          </div>
        )}
        {step===2 && pesanan && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Detail Pesanan</h2>
              <p className="text-sm"><span className="text-slate-500">No. Pesanan</span> : {pesanan.no_pesanan}</p>
              <p className="text-sm"><span className="text-slate-500">Nama</span> : {pesanan.nama_pembeli}</p>
              <p className="text-sm"><span className="text-slate-500">Jumlah</span> : {pesanan.jumlah}</p>
              <p className="text-sm"><span className="text-slate-500">Total</span> : {formatRupiah(pesanan.total || 0)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 text-center space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Scan QRIS</h2>
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
              <input type="file" accept="image/*,application/pdf" onChange={e=>setFile(e.target.files?.[0]||null)} className="block w-full text-sm" />
              <button onClick={upload} disabled={uploading||!file} className="w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{uploading?'Mengupload...':'Upload Bukti Bayar'}</button>
            </div>
          </div>
        )}
        {step===3 && (
          <div className="rounded-2xl border border-slate-200/70 bg-white p-10 text-center shadow-sm shadow-slate-200/40 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">Menunggu Verifikasi</h2>
            <p className="text-slate-500">Setelah diverifikasi, QR tiket akan muncul. Simpan link berikut untuk melihat status dan QR.</p>
            {pesanan?.no_pesanan && pesanan.t && (
              <Link href={`/lacak/${pesanan.no_pesanan}?t=${encodeURIComponent(pesanan.t)}`} className="inline-flex rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white">
                Buka Riwayat Tiket
              </Link>
            )}
            <p className="text-xs text-slate-400">No. Pesanan: {pesanan?.no_pesanan}</p>
            <Link href="/" className="inline-flex text-sm font-medium text-primary-600">Kembali ke Beranda</Link>
          </div>
        )}
      </main>
    </div>
  )
}
