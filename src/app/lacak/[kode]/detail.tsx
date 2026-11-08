'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, Clock, Download, QrCode, Upload, X } from 'lucide-react'
import { PublicBreadcrumb, PublicNavbar } from '@/components/public-navbar'
import { QrImage } from '@/components/qr-image'
import { buatQrisDinamis, buatQrisTanpaNominal } from '@/lib/qris'
import { formatDate, formatDateTime, formatRupiah } from '@/lib/utils'
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

type TenantItem = {
  id: string
  nama: string
  qty: number
  harga_satuan: number
  subtotal: number
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
  jumlah_tenant: number | null
  addon: TenantItem[] | null
  pembayaran_tipe?: string | null
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
  venue_checked_in_by: string | null
  jumlah_tenant: number
  addon: TenantItem[] | null
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
  pembayaran_metode: string | null
  pembayaran_tipe: string | null
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
  merchandise: { nama: string; gambar_url: string | null } | null
  varian: { nama: string } | null
}

type Cicilan = {
  id: string
  no_transaksi: string
  tanggal_bayar: string
  nominal: number
  metode: string
  bukti_url: string | null
  validated: boolean
  validated_by: string | null
  validated_at: string | null
  created_at: string
}

type StatusResponse =
  | { tipe: 'tenant'; kode: string; daftar: DaftarTenant | null; tenant: Tenant | null; kategori: string | null; pembayaran: Pembayaran[]; totalValid: number; eligible: boolean; qr: string | null; waGroup: { nama: string; link: string } | null }
  | { tipe: 'tiket'; kode: string; pesanan: PesananTiket; tiket: TiketIssued[] }
  | { tipe: 'po'; kode: string; po: MerchPo; items: MerchItem[]; cicilan: Cicilan[]; qr: string | null }

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

function BuktiPreview({ url, label = 'Bukti pembayaran', compact = false }: { url: string; label?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <>
      {compact ? (
        <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-primary-600 hover:underline">
          Lihat
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Lihat ${label}`}
            title={`Lihat ${label}`}
            className="group relative block h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:ring-2 hover:ring-primary-200"
          >
            {failed ? (
              <span className="flex h-full w-full items-center justify-center text-[11px] font-medium text-primary-600">Bukti</span>
            ) : (
              <img
                src={url}
                alt={label}
                decoding="async"
                className="h-full w-full object-cover"
                onError={() => setFailed(true)}
              />
            )}
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/0 text-[10px] font-semibold text-white opacity-0 transition group-hover:bg-slate-900/50 group-hover:opacity-100">
              Lihat
            </span>
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700">{label}</p>
            <button type="button" onClick={() => setOpen(true)} className="mt-0.5 text-xs text-primary-600 hover:underline">
              Lihat bukti
            </button>
          </div>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{label}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="bg-slate-50 p-3">
              <div className="mx-auto aspect-[4/5] w-full overflow-hidden rounded-lg bg-slate-100">
                <img src={url} alt={label} className="h-full w-full object-contain" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function BuktiUpload({
  kode,
  token,
  nominal,
  imageOnly = false,
  metodePilihan = false,
  metodeAwal = 'QRIS',
  qrisPayload = '',
  showQris = false,
  onDone,
}: {
  kode: string
  token: string
  nominal?: number
  imageOnly?: boolean
  metodePilihan?: boolean
  metodeAwal?: string
  qrisPayload?: string
  showQris?: boolean
  onDone: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [nilai, setNilai] = useState(nominal ? String(nominal) : '')
  const [metode, setMetode] = useState(metodeAwal === 'Cash' ? 'Cash' : 'QRIS')
  const [loading, setLoading] = useState(false)
  const tampilQris = Boolean(qrisPayload) && (showQris || (metodePilihan && metode === 'QRIS'))
  const qrValue = tampilQris
    ? Number(nilai) > 0
      ? buatQrisDinamis(qrisPayload, Number(nilai))
      : buatQrisTanpaNominal(qrisPayload)
    : ''

  useEffect(() => {
    if (nominal !== undefined) setNilai(String(nominal))
  }, [nominal])

  useEffect(() => {
    if (!imageOnly || !file) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file, imageOnly])

  function pilihFile(next: File | null) {
    if (!next) {
      setFile(null)
      return
    }
    if (!imageOnly) {
      setFile(next)
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
        body: JSON.stringify({
          kode,
          t: token,
          bukti_url: up.url,
          nominal: nominal ? Number(nilai) : undefined,
          metode: metodePilihan ? metode : undefined,
        }),
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
          <input type="number" min={1} placeholder="cth: 50000" value={nilai} onChange={(e) => setNilai(e.target.value)} className={input} />
        </div>
      )}
      {metodePilihan && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Metode Pembayaran</label>
          <div className="grid grid-cols-2 gap-2">
            {(['QRIS', 'Cash'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetode(m)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  metode === m
                    ? 'border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-500/10'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
      {qrValue && (
        <div className="text-center">
          <p className="mb-2 text-xs font-medium text-slate-600">Scan QRIS berikut untuk membayar</p>
          <div className="mx-auto w-fit rounded-xl border border-slate-200 bg-white p-3">
            <QrImage value={qrValue} size={200} />
          </div>
        </div>
      )}
      <input
        type="file"
        accept={imageOnly ? 'image/jpeg,image/png,image/webp' : 'image/*,application/pdf'}
        onChange={(e) => pilihFile(e.target.files?.[0] ?? null)}
        className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-white text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100"
      />
      {imageOnly && <p className="text-xs text-slate-500">JPG, PNG, atau WebP. Maksimal 5MB.</p>}
      {preview && <img src={preview} alt="Pratinjau bukti pembayaran" className="max-h-56 w-full rounded-xl object-contain" />}
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

  const lebar = 'max-w-7xl'

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <PublicNavbar
        title={`Riwayat ${kode}`}
        maxWidth={lebar}
        action={
          <Link
            href="/lacak"
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Lacak lain</span>
            <span className="sm:hidden">Lacak</span>
          </Link>
        }
      />

      <main className={`mx-auto w-full ${lebar} space-y-4 px-4 py-6 sm:px-6 sm:py-8`}>
        <PublicBreadcrumb
          items={[
            { label: 'Beranda', href: '/' },
            { label: 'Lacak Pesanan', href: '/lacak' },
            { label: kode },
          ]}
        />
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
  const { daftar, tenant, kategori, pembayaran, totalValid, qr, waGroup } = data
  const harga = Number(tenant?.harga_akhir ?? daftar?.harga_akhir ?? 0)
  const sisa = Math.max(0, harga - totalValid)
  const progress = harga > 0 ? Math.min(100, Math.round((totalValid / harga) * 100)) : 0
  const addon = tenant?.addon ?? daftar?.addon ?? []
  const jumlahTenant = Number(tenant?.jumlah_tenant ?? daftar?.jumlah_tenant ?? 1)
  const addonTotal = addon.reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0)
  const paketSubtotal = Math.max(0, harga - addonTotal)
  const target80 = Math.ceil(harga * 0.8)
  const kekurangan80 = Math.max(0, target80 - totalValid)
  const nominalAwal = Math.max(1, sisa)
  const nyicil = daftar?.pembayaran_tipe === 'nyicil'
  const [qrisPayload, setQrisPayload] = useState('')

  useEffect(() => {
    fetch('/api/pengaturan/qris')
      .then((r) => r.json())
      .then((d) => setQrisPayload(d.qris_payload ?? ''))
      .catch(() => {})
  }, [])

  if (!tenant) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{daftar?.nama_usaha ?? data.kode}</h1>
              <p className="text-sm text-slate-500">Pendaftaran Tenant</p>
            </div>
            {daftar && <StatusBadge status={daftar.status} />}
          </div>
          {daftar?.catatan_admin && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{daftar.catatan_admin}</p>}
          {daftar?.bukti_url && (
            <div className="mt-3">
              <BuktiPreview url={daftar.bukti_url} />
            </div>
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
      <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{tenant.nama_usaha}</h1>
            <p className="text-sm text-slate-500">Tenant {tenant.kode_stand}</p>
          </div>
          <StatusBadge status={tenant.status} />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-2">Item</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2">{kategori ?? 'Paket tenant'} (Tempat)</td>
                <td className="py-2 text-center">{jumlahTenant}</td>
                <td className="py-2 text-right font-medium">{formatRupiah(paketSubtotal)}</td>
              </tr>
              {addon.map((item) => (
                <tr key={item.id}>
                  <td className="py-2">{item.nama}</td>
                  <td className="py-2 text-center">{item.qty}</td>
                  <td className="py-2 text-right font-medium">{formatRupiah(Number(item.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

        {tenant.status === 'lunas' && (
          <a
            href={`/api/public/struk?kode=${encodeURIComponent(tenant.kode_stand)}&t=${encodeURIComponent(token)}`}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            <Download className="h-4 w-4" /> Download Struk PDF
          </a>
        )}
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
              <CheckCircle2 className="h-4 w-4" /> Sudah masuk venue pada {formatDateTime(tenant.venue_checked_in_at)}{tenant.venue_checked_in_by ? ` oleh ${tenant.venue_checked_in_by}` : ''}
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Tunjukkan QR ini ke petugas saat masuk area venue.</p>
          )}
          {waGroup?.link && (
            <a
              href={waGroup.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg> Gabung {waGroup.nama || 'Grup WhatsApp'}
            </a>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">{nyicil ? 'Riwayat Cicilan' : 'Riwayat Pembayaran'}</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {pembayaran.length} kali pembayaran
          </span>
        </div>
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
                      {p.bukti_url ? <BuktiPreview url={p.bukti_url} compact /> : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {tenant.status !== 'lunas' && sisa > 0 && (
        <>
          <div className={`rounded-2xl border p-4 text-sm ${kekurangan80 > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-green-200 bg-green-50 text-green-800'}`}>
            {kekurangan80 > 0 ? (
              <>Agar QR masuk venue aktif, total pembayaran tervalidasi harus mencapai 80% yaitu <strong>{formatRupiah(target80)}</strong>. Kurang <strong>{formatRupiah(kekurangan80)}</strong> lagi.</>
            ) : (
              <>Pembayaran sudah mencapai target 80% ({formatRupiah(target80)}). QR masuk venue sudah aktif.</>
            )}
          </div>
          <BuktiUpload
            kode={data.kode}
            token={token}
            nominal={nominalAwal}
            imageOnly
            qrisPayload={qrisPayload}
            showQris
            onDone={reload}
          />
        </>
      )}
    </div>
  )
}

function TiketView({ data, token, reload }: { data: Extract<StatusResponse, { tipe: 'tiket' }>; token: string; reload: () => void }) {
  const { pesanan, tiket } = data
  const perluUpload = !pesanan.bukti_url || pesanan.status === 'ditolak'

  const sudahCheckin = tiket.filter((t) => t.status === 'terpakai').length

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="space-y-4 lg:sticky lg:top-24">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-slate-900">{pesanan.tiket_tipe?.nama ?? 'Tiket'}</h1>
              <p className="mt-1 break-words text-sm text-slate-500">{pesanan.no_pesanan} · {pesanan.nama_pembeli}</p>
            </div>
            <StatusBadge status={pesanan.status} />
          </div>

          <dl className="mt-5 divide-y divide-slate-100 border-y border-slate-100">
            <div className="flex items-start justify-between gap-4 py-3">
              <dt className="shrink-0 text-sm text-slate-500">Jumlah</dt>
              <dd className="text-right text-sm font-semibold text-slate-900">{pesanan.jumlah} tiket</dd>
            </div>
            <div className="flex items-start justify-between gap-4 py-3">
              <dt className="shrink-0 text-sm text-slate-500">Total</dt>
              <dd className="text-right text-sm font-semibold text-slate-900">{formatRupiah(Number(pesanan.total))}</dd>
            </div>
            <div className="flex items-start justify-between gap-4 py-3">
              <dt className="shrink-0 text-sm text-slate-500">Dibuat</dt>
              <dd className="text-right text-sm font-semibold text-slate-900">{formatDate(pesanan.created_at)}</dd>
            </div>
            <div className="flex items-start justify-between gap-4 py-3">
              <dt className="shrink-0 text-sm text-slate-500">Kontak</dt>
              <dd className="min-w-0 break-all text-right text-sm font-semibold text-slate-900">{pesanan.kontak}</dd>
            </div>
          </dl>

          {pesanan.status === 'lunas' && (
            <a
              href={`/api/public/struk?kode=${encodeURIComponent(pesanan.no_pesanan)}&t=${encodeURIComponent(token)}`}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              <Download className="h-4 w-4" /> Download Struk PDF
            </a>
          )}

          {pesanan.catatan_admin && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{pesanan.catatan_admin}</p>}
          {pesanan.bukti_url && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <BuktiPreview url={pesanan.bukti_url} />
            </div>
          )}
        </div>

        {perluUpload && pesanan.status !== 'lunas' && (
          <BuktiUpload kode={data.kode} token={token} onDone={reload} />
        )}
      </div>

      <div className="space-y-4">
        {pesanan.status !== 'lunas' && (
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Clock className="h-4 w-4" /> QR Tiket
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {pesanan.status === 'ditolak'
                ? 'Pembayaran ditolak. Silakan unggah ulang bukti pembayaran.'
                : 'QR tiket akan muncul setelah pembayaran diverifikasi admin.'}
            </p>
          </div>
        )}

        {pesanan.status === 'lunas' && tiket.length > 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-900">
                <QrCode className="h-4 w-4" /> QR Tiket
              </div>
              <span className="text-xs text-slate-500">{sudahCheckin} dari {tiket.length} sudah check-in</span>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {tiket.map((t, index) => (
                <div key={t.id} className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 p-4 text-center sm:flex-row sm:text-left">
                  <div className="shrink-0 rounded-xl bg-white p-2 ring-1 ring-slate-100">
                    <QrImage value={t.kode_qr} size={140} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-400">Tiket {index + 1} dari {tiket.length}</p>
                    <p className="mt-0.5 break-all font-mono text-sm font-semibold text-slate-800">{t.kode_tampil}</p>
                    <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${t.status === 'terpakai' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                      {t.status === 'terpakai' ? (t.digunakan_pada ? `Sudah check-in ${formatDateTime(t.digunakan_pada)}` : 'Sudah check-in') : 'Belum check-in'}
                    </p>
                  </div>
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
      </div>
    </div>
  )
}

function PoView({ data, token, reload }: { data: Extract<StatusResponse, { tipe: 'po' }>; token: string; reload: () => void }) {
  const { po, items, qr } = data
  const sisa = Math.max(0, Number(po.total) - Number(po.sudah_dibayar ?? 0))
  const perluUpload = !po.bukti_url || po.status === 'ditolak' || po.status === 'dp_diterima'
  const [qrisPayload, setQrisPayload] = useState('')

  useEffect(() => {
    fetch('/api/pengaturan/qris')
      .then((r) => r.json())
      .then((d) => setQrisPayload(d.qris_payload ?? ''))
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
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
                  <td className="py-2">{item.merchandise?.nama || 'Merchandise'}</td>
                  <td className="py-2">{item.varian?.nama || item.ukuran || '-'}</td>
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
        {po.sudah_dibayar > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
            <div><span className="text-slate-500">Sudah dibayar</span> <span className="font-semibold">{formatRupiah(Number(po.sudah_dibayar))}</span></div>
            <div><span className="text-slate-500">Sisa</span> <span className="font-semibold">{formatRupiah(Math.max(0, Number(po.total) - Number(po.sudah_dibayar)))}</span></div>
          </div>
        )}
        {po.tipe_pemesan === 'Pengurus Himpunan' && po.pembayaran_metode && (
          <p className="mt-2 text-xs text-slate-500">
            Pembayaran: {po.pembayaran_metode} · {po.pembayaran_tipe}
          </p>
        )}
        {po.status === 'lunas' && (
          <a
            href={`/api/public/struk?kode=${encodeURIComponent(po.no_po)}&t=${encodeURIComponent(token)}`}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            <Download className="h-4 w-4" /> Download Struk PDF
          </a>
        )}
        {po.catatan_admin && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{po.catatan_admin}</p>}
        {po.bukti_url && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <BuktiPreview url={po.bukti_url} />
          </div>
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
          <CheckCircle2 className="h-4 w-4" /> Sudah diambil pada {formatDateTime(po.picked_up_at)}
        </div>
      )}

      {!qr && !po.picked_up_at && po.status === 'dp_diterima' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Pembayaran sebagian sudah diterima. Sisa {formatRupiah(sisa)}. Kamu bisa mencicil berapa pun dan berapa kali pun
          lewat form di bawah sampai lunas, lalu QR pengambilan aktif otomatis.
        </div>
      )}

      {perluUpload && po.status !== 'lunas' && (
        <BuktiUpload
          kode={data.kode}
          token={token}
          nominal={sisa}
          imageOnly
          metodePilihan={po.tipe_pemesan === 'Pengurus Himpunan'}
          metodeAwal={po.pembayaran_metode ?? 'QRIS'}
          qrisPayload={qrisPayload}
          onDone={reload}
        />
      )}

      {po.pembayaran_tipe === 'nyicil' && data.cicilan && data.cicilan.length > 0 && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Riwayat Cicilan</h3>
          <div className="mt-4 space-y-3">
            {data.cicilan.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">{c.no_transaksi}</span>
                    <span className={`rounded px-2 py-0.5 text-xs ${c.validated ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {c.validated ? 'Terverifikasi' : 'Menunggu Verifikasi'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">{formatDateTime(c.tanggal_bayar)} · {c.metode}</div>
                  {c.bukti_url && <BuktiPreview url={c.bukti_url} label={`Bukti ${c.no_transaksi}`} compact />}
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900">{formatRupiah(Number(c.nominal))}</div>
                  {c.validated_at && <div className="text-xs text-green-600">Terverifikasi {formatDate(c.validated_at)}</div>}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between rounded-xl bg-slate-100 p-3 text-sm">
            <span className="text-slate-600">Total Cicilan Terverifikasi</span>
            <span className="font-semibold text-slate-900">
              {formatRupiah(data.cicilan.filter((c) => c.validated).reduce((s, c) => s + Number(c.nominal), 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
