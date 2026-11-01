'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '@/app/dankelola/api'
import { hitungHarga, periodeDariTanggal, periodeLabel, KategoriSewa, HargaDasar, FaktorHarga, PeriodeHarga } from '@/lib/types'
import { formatDate, formatRupiah, todayISO } from '@/lib/utils'
import { buatQrisDinamis } from '@/lib/qris'
import QRCode from 'qrcode'

export default function DaftarTenantPublik() {
  const [kategori, setKategori] = useState<Array<{ id: string; kode: string; nama: string }>>([])
  const [hargaDasar, setHargaDasar] = useState<Array<{ kategori_sewa_id: string; jenis_usaha: string; periode: string; harga: number }>>([])
  const [faktor, setFaktor] = useState<Array<{ tipe: string; nilai: string; multiplier: number }>>([])
  const [periods, setPeriods] = useState<PeriodeHarga[]>([])
  const [acara, setAcara] = useState<{ tanggal_acara: string } | null>(null)
  const [qris, setQris] = useState<Record<string, string>>({})
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    nama_usaha: '', kontak: '', email: '', alamat: '', deskripsi_usaha: '',
    kategori_sewa_id: '', jenis_usaha: 'F&B', asal: 'Internal Kampus', lokasi: 'Reguler',
  })
  const [pendaftaran, setPendaftaran] = useState<{ id: string; kode_pendaftaran: string; nama_usaha: string; kontak: string; harga_akhir: number; dp_wajib: number; t?: string } | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [qr, setQr] = useState('')

  useEffect(() => {
    Promise.all([
      getJSON<{ kategori: KategoriSewa[]; hargaDasar: HargaDasar[]; faktor: FaktorHarga[]; periode: PeriodeHarga[] }>('/api/master'),
      getJSON<Record<string, string>>('/api/pengaturan/qris'),
      getJSON<{ tanggal_acara: string } | null>('/api/acara')
    ]).then(([m, q, a]) => {
      setKategori(m.kategori || [])
      setHargaDasar(m.hargaDasar || [])
      setFaktor(m.faktor || [])
      setPeriods(m.periode || [])
      setQris(q)
      setAcara(a)
    })
  }, [])

  const periode = periodeDariTanggal(todayISO(), periods)
  const harga = useMemo(() => {
    const hd = hargaDasar.find((h) => h.kategori_sewa_id === form.kategori_sewa_id && h.jenis_usaha === form.jenis_usaha && h.periode === periode)
    if (!hd) return 0
    const fa = faktor.find((f) => f.tipe === 'asal' && f.nilai === form.asal)?.multiplier ?? 1
    const fl = faktor.find((f) => f.tipe === 'lokasi' && f.nilai === form.lokasi)?.multiplier ?? 1
    return hitungHarga(hd.harga, fa, fl)
  }, [form, hargaDasar, faktor, periode])
  const dp = Math.ceil(harga/2)

  useEffect(() => {
    const nominal = pendaftaran?.dp_wajib
    if (!qris.qris_payload || !nominal) {
      setQr('')
      return
    }
    const payload = buatQrisDinamis(qris.qris_payload, nominal)
    QRCode.toDataURL(payload, { width: 320, margin: 2, errorCorrectionLevel: 'H' }).then(setQr).catch(()=>{})
  }, [qris, pendaftaran])

  async function daftar() {
    if (!periode) return toast.error('Tanggal daftar di luar periode open tenant')
    try {
      const res = await sendJSON('/api/public/tenant', 'POST', { ...form, periode_daftar: periode, harga_akhir: harga, dp_wajib: dp })
      setPendaftaran(res as typeof pendaftaran)
      setPendaftaran(res)
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

  const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10'

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <header className="border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-sm font-semibold text-white">DU</span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Pendaftaran Tenant</p>
              <p className="text-xs text-slate-500">Dana Usaha HMTI</p>
            </div>
          </Link>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">Kembali ke Beranda</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {step===1 && (
          <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
            <div className="p-6 border-b border-slate-100">
              <h1 className="text-xl font-semibold text-slate-900">Form Pendaftaran Tenant</h1>
              <p className="text-sm text-slate-500">Isi data usaha kamu sesuai ketentuan open tenant.</p>
            </div>
            <div className="p-6 grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium">Nama Usaha</label><input className={input} value={form.nama_usaha} onChange={e=>setForm({...form,nama_usaha:e.target.value})}/></div>
              <div><label className="mb-1 block text-sm font-medium">Kontak WA</label><input className={input} value={form.kontak} onChange={e=>setForm({...form,kontak:e.target.value})}/></div>
              <div><label className="mb-1 block text-sm font-medium">Email (opsional)</label><input className={input} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium">Alamat</label><input className={input} value={form.alamat} onChange={e=>setForm({...form,alamat:e.target.value})}/></div>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium">Deskripsi Usaha</label><textarea className={input} value={form.deskripsi_usaha} onChange={e=>setForm({...form,deskripsi_usaha:e.target.value})}/></div>
              <div>
                <label className="mb-1 block text-sm font-medium">Kategori Sewa</label>
                <select className={input} value={form.kategori_sewa_id} onChange={e=>setForm({...form,kategori_sewa_id:e.target.value})}>
                  <option value="">Pilih</option>
                  {kategori.map((k)=><option key={k.id} value={k.id}>{k.kode} - {k.nama}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Jenis Usaha</label>
                <select className={input} value={form.jenis_usaha} onChange={e=>setForm({...form,jenis_usaha:e.target.value})}><option>F&B</option><option>Non-F&B</option></select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Asal</label>
                <select className={input} value={form.asal} onChange={e=>setForm({...form,asal:e.target.value})}><option>Internal Kampus</option><option>Eksternal</option></select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Lokasi</label>
                <select className={input} value={form.lokasi} onChange={e=>setForm({...form,lokasi:e.target.value})}><option>Reguler</option><option>Strategis 1</option><option>Strategis 2</option></select>
              </div>
              <div className="md:col-span-2 rounded-xl bg-slate-50 p-4 flex items-center justify-between">
                <div className="text-sm">
                  <p>Periode: <span className="font-medium">{periode ? periodeLabel(periode, periods) : 'Di luar periode'}</span></p>
                  <p className="text-slate-500">{periods.map((p)=>`${p.nama} ${p.tanggal_mulai}–${p.tanggal_selesai}`).join(' • ')}</p>
                  {acara?.tanggal_acara && <p className="text-slate-500">Tanggal Acara: {formatDate(acara.tanggal_acara)}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Estimasi Harga</p>
                  <p className="text-lg font-semibold text-indigo-600">{formatRupiah(harga)}</p>
                  <p className="text-xs text-slate-500">DP 50% {formatRupiah(dp)}</p>
                </div>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button onClick={daftar} disabled={!periode || !form.nama_usaha || !form.kontak || !form.kategori_sewa_id} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">Lanjut ke Pembayaran</button>
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
              <button onClick={upload} disabled={uploading || !file} className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{uploading ? 'Mengupload...' : 'Upload Bukti Bayar'}</button>
            </div>
          </div>
        )}

        {step===3 && (
          <div className="rounded-2xl border border-slate-200/70 bg-white p-10 text-center shadow-sm shadow-slate-200/40 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">Bukti Terkirim</h2>
            <p className="text-slate-500">Pendaftaran kamu sedang menunggu verifikasi oleh panitia Dana Usaha. Simpan link berikut untuk melihat riwayat pembayaran dan QR masuk venue.</p>
            {pendaftaran?.t && (
              <Link href={`/lacak/${pendaftaran.kode_pendaftaran}?t=${encodeURIComponent(pendaftaran.t)}`} className="inline-flex rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white">
                Buka Riwayat Tenant
              </Link>
            )}
            <p className="text-xs text-slate-400">Kode: {pendaftaran?.kode_pendaftaran}</p>
            <Link href="/" className="inline-flex text-sm font-medium text-indigo-600">Kembali ke Beranda</Link>
          </div>
        )}
      </main>
    </div>
  )
}
