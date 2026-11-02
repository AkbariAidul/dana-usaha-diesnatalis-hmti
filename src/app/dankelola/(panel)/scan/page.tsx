'use client'

import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { QrCode, X } from 'lucide-react'
import { QrScanner } from '@/components/qr-scanner'
import { beep } from '@/lib/beep'
import { formatDateTime, formatRupiah } from '@/lib/utils'

type TenantResult = {
  tipe: 'tenant'
  tenant: { kode_stand: string; nama_usaha: string; harga_akhir: number; status: string; venue_checked_in_at: string | null }
  total: number
  eligible: boolean
  sudahMasuk: boolean
}

type PoResult = {
  tipe: 'po'
  po: {
    no_po: string
    nama_pemesan: string
    tipe_pemesan: string
    total: number
    status: string
    picked_up_at: string | null
    items: Array<{ id: string; ukuran: string | null; qty: number; varian: { nama: string } | null }>
  }
  sudahDiambil: boolean
}

type TiketResult = {
  tipe: 'tiket'
  tiket: { kode_tampil: string; kode_qr: string; status: string; digunakan_pada: string | null; nomor: number; total: number }
  pesanan: { no_pesanan: string; nama_pembeli: string; kontak: string; email: string | null; jumlah: number; harga_satuan: number; diskon_persen: number | null; total: number; status: string; created_at: string; tiket_tipe: { nama: string } | null; periode_nama?: string | null } | null
  sudahCheckin: boolean
}

type Result = TenantResult | PoResult | TiketResult

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'

const PESANAN_STATUS: Record<string, string> = {
  menunggu_verifikasi: 'Menunggu Verifikasi',
  lunas: 'Lunas',
  ditolak: 'Ditolak',
  batal: 'Batal',
}

function statusPesananLabel(status: string) {
  return PESANAN_STATUS[status] ?? status.replace(/_/g, ' ')
}

export default function ScanPage() {
  const [manual, setManual] = useState('')
  const [payload, setPayload] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)

  async function lookup(value: string, action: 'lookup' | 'confirm' = 'lookup') {
    if (!value.trim()) return
    setPayload(value.trim())
    setLoading(true)
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: value.trim(), action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'QR tidak valid')
      beep()
      if (action === 'confirm') {
        toast.success('Berhasil dikonfirmasi')
        setResult(null)
      } else {
        setResult(data)
      }
    } catch (e) {
      toast.error((e as Error).message)
      if (action === 'lookup') setResult(null)
    } finally {
      setLoading(false)
    }
  }

  function submitManual(e: FormEvent) {
    e.preventDefault()
    void lookup(manual)
  }

  const sudah = result?.tipe === 'tenant' ? result.sudahMasuk : result?.tipe === 'po' ? result.sudahDiambil : result?.tipe === 'tiket' ? result.sudahCheckin : false

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
          <QrCode className="h-6 w-6" /> Scan QR
        </h1>
        <p className="text-sm text-slate-500">Scan tiket, QR masuk tenant, atau QR pickup merchandise.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-900">Kamera</h2>
          <QrScanner onScan={(value) => void lookup(value)} paused={!!result} />
        </div>

        <div className="space-y-4">
          <form onSubmit={submitManual} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-slate-900">Input Manual</h2>
            <div className="flex gap-2">
              <input className={input} placeholder="Kode QR / kode tampil / isi QR" value={manual} onChange={(e) => setManual(e.target.value)} />
              <button type="submit" disabled={loading || !manual.trim()} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                Cek
              </button>
            </div>
          </form>
        </div>
      </div>

      {result && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setResult(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {result.tipe === 'tenant' ? 'Tenant' : result.tipe === 'po' ? 'PO Merchandise' : 'Tiket'}
              </p>
              <button
                type="button"
                onClick={() => setResult(null)}
                aria-label="Tutup"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {result.tipe === 'tenant' && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-900">{result.tenant.nama_usaha}</h3>
                <p className="text-sm text-slate-500">{result.tenant.kode_stand}</p>
                <p className="text-sm">Terverifikasi: <b>{formatRupiah(result.total)}</b> / {formatRupiah(Number(result.tenant.harga_akhir))}</p>
                <p className="text-sm">Status: {result.tenant.status}</p>
                {result.sudahMasuk && <p className="text-sm text-green-700">Sudah masuk venue.</p>}
                <button onClick={() => void lookup(payload, 'confirm')} disabled={result.sudahMasuk} className="mt-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  Tandai Masuk Venue
                </button>
              </div>
            )}

            {result.tipe === 'po' && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-900">{result.po.no_po}</h3>
                <p className="text-sm text-slate-500">{result.po.nama_pemesan} · {result.po.tipe_pemesan}</p>
                <div className="rounded-xl bg-slate-50 p-3 text-sm">
                  {result.po.items?.map((item) => (
                    <div key={item.id}>{item.varian?.nama || item.ukuran || 'Item'} × {item.qty}</div>
                  ))}
                </div>
                <p className="text-sm">Total: <b>{formatRupiah(Number(result.po.total))}</b></p>
                <p className="text-sm">Status: {result.po.status}</p>
                {result.sudahDiambil && <p className="text-sm text-green-700">Sudah diambil.</p>}
                <button onClick={() => void lookup(payload, 'confirm')} disabled={result.sudahDiambil} className="mt-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  Tandai Sudah Diambil
                </button>
              </div>
            )}

            {result.tipe === 'tiket' && (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {result.pesanan?.nama_pembeli || result.tiket.kode_tampil}
                    </h3>
                    <p className="font-mono text-xs text-slate-500">{result.tiket.kode_tampil}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
                    Tiket {result.tiket.nomor} / {result.tiket.total}
                  </span>
                </div>

                {result.pesanan ? (
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-slate-500">No. Pesanan</dt>
                      <dd className="font-medium text-slate-900">{result.pesanan.no_pesanan}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Tipe Tiket</dt>
                      <dd className="font-medium text-slate-900">{result.pesanan.tiket_tipe?.nama || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Kontak</dt>
                      <dd className="text-slate-900">{result.pesanan.kontak}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Email</dt>
                      <dd className="text-slate-900">{result.pesanan.email || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Jumlah</dt>
                      <dd className="text-slate-900">{result.pesanan.jumlah} tiket</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Harga Satuan</dt>
                      <dd className="text-slate-900">{formatRupiah(Number(result.pesanan.harga_satuan))}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Diskon Bundle</dt>
                      <dd className="text-slate-900">
                        {Number(result.pesanan.diskon_persen) > 0
                          ? `${result.pesanan.diskon_persen}% (${result.pesanan.jumlah} tiket)`
                          : '-'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Total Bayar</dt>
                      <dd className="font-semibold text-slate-900">{formatRupiah(Number(result.pesanan.total))}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Periode</dt>
                      <dd className="text-slate-900">{result.pesanan.periode_nama || 'Harga dasar'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Waktu Pembelian</dt>
                      <dd className="text-slate-900">{formatDateTime(result.pesanan.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Status Pesanan</dt>
                      <dd className="text-slate-900">{statusPesananLabel(result.pesanan.status)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Status Tiket</dt>
                      <dd className="text-slate-900">{result.tiket.status === 'terpakai' ? 'Sudah check-in' : 'Belum check-in'}</dd>
                    </div>
                    {result.tiket.digunakan_pada && (
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-slate-500">Waktu Check-in</dt>
                        <dd className="text-slate-900">{formatDateTime(result.tiket.digunakan_pada)}</dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <p className="text-sm text-slate-500">Detail pembeli tidak ditemukan.</p>
                )}

                <button onClick={() => void lookup(payload, 'confirm')} disabled={result.sudahCheckin} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  Check-in
                </button>
              </div>
            )}

            {sudah && <p className="mt-2 text-xs text-slate-500">Data ini sudah pernah dikonfirmasi.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
