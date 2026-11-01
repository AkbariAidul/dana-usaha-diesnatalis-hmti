'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, Clock, QrCode, Upload } from 'lucide-react'
import { formatDate, formatRupiah } from '@/lib/utils'
import { useLiveRefresh } from '@/lib/use-live-refresh'

type Pembayaran = {
  id: string
  tanggal_bayar: string
  jenis: string
  nominal: number
  metode: string
  bukti_url: string | null
  validated: boolean
  keterangan: string | null
  created_at: string
}

type DaftarTenant = {
  kode_pendaftaran: string
  nama_usaha: string
  kontak: string
  status: string
  harga_akhir: number
  dp_wajib: number
  bukti_url: string | null
  catatan_admin: string | null
  created_at: string
}

type Tenant = {
  kode_stand: string
  nama_usaha: string
  kontak: string
  harga_akhir: number
  dp_wajib: number
  sudah_dibayar: number
  status: string
  tgl_acara: string | null
  venue_checked_in_at: string | null
}

type PesananTiket = {
  id: string
  no_pesanan: string
  nama_pembeli: string
  kontak: string
  jumlah: number
  harga_satuan: number
  total: number
  status: string
  bukti_url: string | null
  catatan_admin: string | null
  verified_at: string | null
  created_at: string
  tiket_tipe: { nama: string } | null
}

type TiketIssued = {
  id: string
  kode_qr: string
  kode_tampil: string
  status: string
  digunakan_pada: string | null
}

type MerchPo = {
  id: string
  no_po: string
  nama_pemesan: string
  kontak: string
  tipe_pemesan: string
  harga_per_item: number
  total: number
  sudah_dibayar: number
  status: string
  bukti_url: string | null
  catatan_admin: string | null
  verified_at: string | null
  picked_up_at: string | null
  created_at: string
  pengurus: { nama: string; divisi: string | null } | null
}

type MerchItem = {
  id: string
  ukuran: string | null
  qty: number
  harga_satuan: number
  subtotal: number
  varian: { nama: string } | null
}

type StatusResponse =
  | { tipe: 'tenant'; kode: string; daftar: DaftarTenant | null; tenant: Tenant | null; pembayaran: Pembayaran[]; totalValid: number; eligible: boolean; qr: string | null }
  | { tipe: 'tiket'; kode: string; pesanan: PesananTiket; tiket: TiketIssued[] }
  | { tipe: 'po'; kode: string; po: MerchPo; items: MerchItem[]; qr: string | null }

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'

function statusLabel(status: string) {
  const map: Record<string, string> = {
    menunggu_verifikasi: 'Menunggu Verifikasi',
    dp_diterima: 'DP Diterima',
    dp: 'DP Diterima',
    cicil: 'Dicicil',
    lunas: 'Lunas',
    ditolak: 'Ditolak',
    batal: 'Dibatalkan',
    daftar: 'Terdaftar',
    menunggak: 'Menunggak',
    belum_divalidasi: 'Belum Check-in',
    terpakai: 'Sudah Check-in',
  }
  return map[status] ?? status.replace(/_/g, ' ')
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'lunas' || status === 'terpakai'
    ? 'bg-green-100 text-green-800'
    : status === 'ditolak' || status === 'batal' || status === 'menunggak'
      ? 'bg-red-100 text-red-800'
      : status === 'dp_diterima' || status === 'dp' || status === 'cicil'
        ? 'bg-blue-100 text-blue-800'
        : 'bg-yellow-100 text-yellow-800'
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>{statusLabel(status)}</span>
}

function QrImage({ value, size = 240 }: { value: string; size?: number }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    QRCode.toDataURL(value, { width: size, margin: 2, errorCorrectionLevel: 'H' }).then(setSrc).catch(() => setSrc(''))
  }, [value, size])
  if (!src) return <div className="animate-pulse rounded-xl bg-slate-100" style={{ width: size, height: size }} />
  return <img src={src} alt="QR Code" className="rounded-xl" style={{ width: size, height: size }} />
}

function BuktiUpload({ kode, token, nominal, onDone }: { kode: string; token: string; nominal?: number; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [nilai, setNilai] = useState(nominal ? String(nominal) : '')
  const [loading, setLoading] = useState(false)

  async function kirim(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'bukti-lacak')
      const up = await fetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json())
      if (!up.url) throw new Error(up.error || 'Upload gagal')

      const res = await fetch('/api/public/status/bukti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kode, t: token, bukti_url: up.url, nominal: nominal ? Number(nilai) : undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim bukti')
      toast.success(data.message || 'Bukti terkirim')
      setFile(null)
      onDone()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={kirim} className="space-y-3 rounded-2xl border border-primary-200 bg-primary-50/60 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-primary-900">
        <Upload className="h-4 w-4" /> Upload Bukti Pembayaran
      </div>
      {nominal !== undefined && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Nominal</label>
          <input type="number" min={1} value={nilai} onChange={(e) => setNilai(e.target.value)} className={input} />
        </div>
      )}
      <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
      <button type="submit" disabled={loading || !file} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {loading ? 'Mengirim...' : 'Kirim Bukti'}
      </button>
    </form>
  )
}

export function LacakDetail({ kode, token }: { kode: string; token: string }) {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`/api/public/status?kode=${encodeURIComponent(kode)}&t=${encodeURIComponent(token)}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal memuat data')
      setData(json)
      setError(null)
    } catch (err) {
      if (!silent) setError((err as Error).message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [kode, token])

  useEffect(() => { void load() }, [load])
  useLiveRefresh(() => load(true), 3000)

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <header className="border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-600 text-sm font-semibold text-white">DU</span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Riwayat {kode}</p>
              <p className="text-xs text-slate-500">Dies Natalis HMTI</p>
            </div>
          </Link>
          <Link href="/lacak" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Lacak lain
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        {loading && <div className="h-48 animate-pulse rounded-2xl bg-white" />}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-red-600">{error}</p>
            <Link href="/lacak" className="mt-3 inline-block text-sm text-red-700 hover:underline">Coba kode lain</Link>
          </div>
        )}

        {data?.tipe === 'tenant' && <TenantView data={data} token={token} reload={load} />}
        {data?.tipe === 'tiket' && <TiketView data={data} token={token} reload={load} />}
        {data?.tipe === 'po' && <PoView data={data} token={token} reload={load} />}
      </main>
    </div>
  )
}

function TenantView({ data, token, reload }: { data: Extract<StatusResponse, { tipe: 'tenant' }>; token: string; reload: () => void }) {
  const { daftar, tenant, pembayaran, totalValid, qr } = data
  const harga = Number(tenant?.harga_akhir ?? daftar?.harga_akhir ?? 0)
  const sisa = Math.max(0, harga - totalValid)
  const progress = harga > 0 ? Math.min(100, Math.round((totalValid / harga) * 100)) : 0

  if (!tenant) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{daftar?.nama_usaha ?? data.kode}</h1>
              <p className="text-sm text-slate-500">Pendaftaran Tenant</p>
            </div>
            {daftar && <StatusBadge status={daftar.status} />}
          </div>
          {daftar?.catatan_admin && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{daftar.catatan_admin}</p>}
          {daftar?.bukti_url && (
            <a href={daftar.bukti_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-primary-600 hover:underline">
              Lihat bukti pembayaran
            </a>
          )}
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Clock className="h-4 w-4" />
            {daftar?.status === 'ditolak' ? 'Pendaftaran ditolak. Hubungi admin.' : 'Menunggu verifikasi admin. Riwayat pembayaran muncul setelah DP diterima.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{tenant.nama_usaha}</h1>
            <p className="text-sm text-slate-500">Tenant {tenant.kode_stand}</p>
          </div>
          <StatusBadge status={tenant.status} />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Total Tagihan</p>
            <p className="font-semibold text-slate-900">{formatRupiah(harga)}</p>
          </div>
          <div className="rounded-xl bg-green-50 p-3">
            <p className="text-xs text-green-700">Terverifikasi</p>
            <p className="font-semibold text-green-800">{formatRupiah(totalValid)}</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3">
            <p className="text-xs text-amber-700">Sisa</p>
            <p className="font-semibold text-amber-800">{formatRupiah(sisa)}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Progress pembayaran</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-primary-600" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">QR masuk venue aktif setelah pembayaran tervalidasi mencapai 80%.</p>
        </div>
      </div>

      {qr && (
        <div className="rounded-2xl border border-primary-200 bg-white p-6 text-center shadow-sm">
          <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium text-primary-900">
            <QrCode className="h-4 w-4" /> QR Masuk Venue
          </div>
          <div className="mx-auto w-fit rounded-2xl border border-slate-200 bg-white p-3">
            <QrImage value={qr} />
          </div>
          {tenant.venue_checked_in_at ? (
            <p className="mt-3 flex items-center justify-center gap-1 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" /> Sudah masuk venue pada {formatDate(tenant.venue_checked_in_at)}
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Tunjukkan QR ini ke petugas saat masuk area venue.</p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">Riwayat Pembayaran</h2>
        {pembayaran.length === 0 && <p className="text-sm text-slate-400">Belum ada pembayaran.</p>}
        {pembayaran.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-2">Tanggal</th>
                  <th className="py-2">Jenis</th>
                  <th className="py-2">Nominal</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Bukti</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pembayaran.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 text-slate-600">{formatDate(p.tanggal_bayar)}</td>
                    <td className="py-2">{p.jenis}</td>
                    <td className="py-2 font-medium">{formatRupiah(Number(p.nominal))}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${p.validated ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {p.validated ? 'Terverifikasi' : 'Menunggu'}
                      </span>
                    </td>
                    <td className="py-2">
                      {p.bukti_url ? <a href={p.bukti_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">Lihat</a> : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {tenant.status !== 'lunas' && sisa > 0 && (
        <BuktiUpload kode={data.kode} token={token} nominal={sisa} onDone={reload} />
      )}
    </div>
  )
}

function TiketView({ data, token, reload }: { data: Extract<StatusResponse, { tipe: 'tiket' }>; token: string; reload: () => void }) {
  const { pesanan, tiket } = data
  const perluUpload = !pesanan.bukti_url || pesanan.status === 'ditolak'

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{pesanan.tiket_tipe?.nama ?? 'Tiket'}</h1>
            <p className="text-sm text-slate-500">{pesanan.no_pesanan} · {pesanan.nama_pembeli}</p>
          </div>
          <StatusBadge status={pesanan.status} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Jumlah</p>
            <p className="font-semibold">{pesanan.jumlah} tiket</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Total</p>
            <p className="font-semibold">{formatRupiah(Number(pesanan.total))}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Dibuat</p>
            <p className="font-semibold">{formatDate(pesanan.created_at)}</p>
          </div>
        </div>
        {pesanan.catatan_admin && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{pesanan.catatan_admin}</p>}
        {pesanan.bukti_url && (
          <a href={pesanan.bukti_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-primary-600 hover:underline">
            Lihat bukti pembayaran
          </a>
        )}
      </div>

      {pesanan.status === 'lunas' && tiket.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 font-semibold text-emerald-900">
            <QrCode className="h-4 w-4" /> QR Tiket
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {tiket.map((t) => (
              <div key={t.id} className="rounded-2xl border border-slate-200 p-4 text-center">
                <QrImage value={t.kode_qr} size={180} />
                <p className="mt-2 font-mono text-xs text-slate-600">{t.kode_tampil}</p>
                <p className={`mt-1 text-xs ${t.status === 'terpakai' ? 'text-green-700' : 'text-slate-500'}`}>
                  {t.status === 'terpakai' ? `Sudah check-in ${t.digunakan_pada ? formatDate(t.digunakan_pada) : ''}` : 'Belum check-in'}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-500">Tunjukkan masing-masing QR ke petugas saat check-in hari H.</p>
        </div>
      )}

      {pesanan.status === 'lunas' && tiket.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Pembayaran sudah lunas, tetapi QR tiket belum terbit. Hubungi admin.
        </div>
      )}

      {perluUpload && pesanan.status !== 'lunas' && (
        <BuktiUpload kode={data.kode} token={token} onDone={reload} />
      )}
    </div>
  )
}

function PoView({ data, token, reload }: { data: Extract<StatusResponse, { tipe: 'po' }>; token: string; reload: () => void }) {
  const { po, items, qr } = data
  const perluUpload = !po.bukti_url || po.status === 'ditolak'

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{po.no_po}</h1>
            <p className="text-sm text-slate-500">{po.nama_pemesan} · {po.tipe_pemesan}</p>
            {po.pengurus && <p className="text-xs text-slate-400">{po.pengurus.divisi || 'Pengurus Himpunan'}</p>}
          </div>
          <StatusBadge status={po.status} />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-2">Item</th>
                <th className="py-2">Ukuran</th>
                <th className="py-2">Qty</th>
                <th className="py-2">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2">{item.varian?.nama || 'Merchandise'}</td>
                  <td className="py-2">{item.ukuran || '-'}</td>
                  <td className="py-2">{item.qty}</td>
                  <td className="py-2 font-medium">{formatRupiah(Number(item.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-between rounded-xl bg-slate-50 p-3 text-sm">
          <span className="text-slate-500">Total</span>
          <span className="font-semibold text-slate-900">{formatRupiah(Number(po.total))}</span>
        </div>
        {po.catatan_admin && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{po.catatan_admin}</p>}
        {po.bukti_url && (
          <a href={po.bukti_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-primary-600 hover:underline">
            Lihat bukti pembayaran
          </a>
        )}
      </div>

      {qr && (
        <div className="rounded-2xl border border-violet-200 bg-white p-6 text-center shadow-sm">
          <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium text-violet-900">
            <QrCode className="h-4 w-4" /> QR Pengambilan Merchandise
          </div>
          <div className="mx-auto w-fit rounded-2xl border border-slate-200 bg-white p-3">
            <QrImage value={qr} />
          </div>
          <p className="mt-3 text-sm text-slate-500">Tunjukkan QR ini ke petugas untuk mengambil pesanan.</p>
        </div>
      )}

      {po.picked_up_at && (
        <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4" /> Sudah diambil pada {formatDate(po.picked_up_at)}
        </div>
      )}

      {!qr && !po.picked_up_at && po.status === 'dp_diterima' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          DP sudah diterima. Pelunasan dilakukan ke admin, setelah lunas QR pengambilan akan muncul.
        </div>
      )}

      {perluUpload && po.status !== 'lunas' && (
        <BuktiUpload kode={data.kode} token={token} onDone={reload} />
      )}
    </div>
  )
}
