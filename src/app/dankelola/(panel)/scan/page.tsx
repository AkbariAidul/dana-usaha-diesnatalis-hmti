'use client'

import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { QrCode, X } from 'lucide-react'
import { QrScanner } from '@/components/qr-scanner'
import { useIsViewer } from '@/lib/dashboard-user'
import { beep } from '@/lib/beep'
import { formatDateTime, formatRupiah } from '@/lib/utils'

type TenantAddon = {
  nama: string
  qty: number
  subtotal: number
}

type TenantResult = {
  tipe: 'tenant'
  tenant: {
    kode_stand: string
    nama_usaha: string
    kontak: string
    email: string | null
    jenis_usaha: string
    asal: string
    lokasi: string
    periode_daftar: string
    harga_akhir: number
    dp_wajib: number
    sudah_dibayar: number
    jumlah_tenant: number
    tgl_daftar: string
    tgl_dp: string | null
    tgl_acara: string | null
    status: string
    keterangan: string | null
    addon: TenantAddon[] | null
    venue_checked_in_at: string | null
    venue_checked_in_by: string | null
    kategori_sewa: { kode: string; nama: string } | null
  }
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
    kontak: string
    total: number
    sudah_dibayar: number | null
    pembayaran_metode: string | null
    pembayaran_tipe: string | null
    status: string
    created_at: string
    catatan_admin: string | null
    picked_up_at: string | null
    items: Array<{
      id: string
      ukuran: string | null
      qty: number
      harga_satuan: number
      subtotal: number
      merchandise: { nama: string } | null
      varian: { nama: string } | null
    }>
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
  dp_diterima: 'DP Diterima',
  lunas: 'Lunas',
  ditolak: 'Ditolak',
  batal: 'Batal',
}

function statusPesananLabel(status: string) {
  return PESANAN_STATUS[status] ?? status.replace(/_/g, ' ')
}

const TENANT_STATUS: Record<string, string> = {
  daftar: 'Terdaftar',
  dp: 'DP Diterima',
  cicil: 'Dicicil',
  lunas: 'Lunas',
  menunggak: 'Menunggak',
  batal: 'Batal',
}

function statusTenantLabel(status: string) {
  return TENANT_STATUS[status] ?? status.replace(/_/g, ' ')
}

function statusTenantClass(status: string) {
  if (status === 'lunas') return 'bg-green-100 text-green-800'
  if (status === 'batal' || status === 'menunggak') return 'bg-red-100 text-red-800'
  if (status === 'dp' || status === 'cicil') return 'bg-blue-100 text-blue-800'
  return 'bg-amber-100 text-amber-800'
}

export default function ScanPage() {
  const isViewer = useIsViewer()
  const [manual, setManual] = useState('')
  const [payload, setPayload] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)

  async function lookup(value: string, action: 'lookup' | 'confirm' = 'lookup') {
    if (isViewer) return
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
        const active = document.activeElement as HTMLElement | null
        active?.blur()
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
          {isViewer ? (
            <p className="rounded-xl bg-amber-50 px-3 py-4 text-sm text-amber-800">Mode lihat saja: kamera scan dinonaktifkan.</p>
          ) : (
            <QrScanner onScan={(value) => void lookup(value)} paused={!!result} />
          )}
        </div>

        <div className="space-y-4">
          <form onSubmit={submitManual} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-slate-900">Input Manual</h2>
            <div className="flex gap-2">
              <input disabled={isViewer} className={`${input} disabled:bg-slate-50 disabled:text-slate-400`} placeholder="Kode QR / kode tampil / isi QR" value={manual} onChange={(e) => setManual(e.target.value)} />
              <button type="submit" disabled={isViewer || loading || !manual.trim()} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
                Cek
              </button>
            </div>
            {isViewer && <p className="mt-2 text-xs text-amber-700">Mode lihat saja: input manual dan scan QR tidak bisa dipakai.</p>}
          </form>
        </div>
      </div>

      {result && (
        <div
          className="fixed inset-x-0 top-0 z-50 flex h-[100dvh] items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setResult(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className={`max-h-[calc(100dvh-2rem)] w-full overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-xl sm:p-5 ${result.tipe === 'po' ? 'max-w-2xl' : 'max-w-md'}`}
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

            {result.tipe === 'tenant' && (() => {
              const t = result.tenant
              const harga = Number(t.harga_akhir)
              const terverifikasi = Number(result.total)
              const sisa = Math.max(0, harga - terverifikasi)
              const target80 = Math.ceil(harga * 0.8)
              const kurang80 = Math.max(0, target80 - terverifikasi)
              const persen = harga > 0 ? Math.min(100, Math.round((terverifikasi / harga) * 100)) : 0
              const addon = t.addon ?? []
              return (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{t.nama_usaha}</h3>
                      <p className="text-sm text-slate-500">{t.kode_stand}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusTenantClass(t.status)}`}>
                      {statusTenantLabel(t.status)}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs [&_dd]:break-words sm:gap-y-3 sm:p-4 sm:text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Kontak</dt>
                      <dd className="font-medium text-slate-900">{t.kontak || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Email</dt>
                      <dd className="text-slate-900">{t.email || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Kategori</dt>
                      <dd className="text-slate-900">{t.kategori_sewa?.nama || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Jenis Usaha</dt>
                      <dd className="text-slate-900">{t.jenis_usaha || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Asal</dt>
                      <dd className="text-slate-900">{t.asal || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Lokasi</dt>
                      <dd className="text-slate-900">{t.lokasi || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Periode</dt>
                      <dd className="text-slate-900">{t.periode_daftar?.replace(/_/g, ' ') || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Jumlah Tenant</dt>
                      <dd className="text-slate-900">{t.jumlah_tenant ?? 1} orang</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Tanggal Daftar</dt>
                      <dd className="text-slate-900">{t.tgl_daftar ? formatDateTime(t.tgl_daftar) : '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Tanggal Acara</dt>
                      <dd className="text-slate-900">{t.tgl_acara ? formatDateTime(t.tgl_acara) : '-'}</dd>
                    </div>
                    {t.keterangan && (
                      <div className="col-span-2">
                        <dt className="text-xs text-slate-500">Keterangan</dt>
                        <dd className="text-slate-900">{t.keterangan}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="rounded-xl border border-slate-200 p-3 sm:p-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:text-sm">
                      <div>
                        <p className="text-xs text-slate-500">Total Tagihan</p>
                        <p className="font-semibold text-slate-900">{formatRupiah(harga)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Terverifikasi</p>
                        <p className="font-semibold text-green-700">{formatRupiah(terverifikasi)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Sisa</p>
                        <p className="font-semibold text-orange-600">{formatRupiah(sisa)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Target QR (80%)</p>
                        <p className="font-medium text-slate-900">{formatRupiah(target80)}</p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-green-500" style={{ width: `${persen}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {persen}% terbayar · {result.eligible ? 'QR venue aktif' : `kurang ${formatRupiah(kurang80)} lagi`}
                    </p>
                  </div>

                  {addon.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500">Item Tambahan</p>
                      <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                        {addon.map((item, index) => (
                          <li key={`${item.nama}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2">
                            <span className="text-slate-900">{item.nama} x{item.qty}</span>
                            <span className="shrink-0 font-medium tabular-nums text-slate-900">{formatRupiah(Number(item.subtotal))}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.sudahMasuk ? (
                    <div className="rounded-xl bg-green-50 p-3 text-sm text-green-800">
                      <p className="font-medium">Sudah masuk venue.</p>
                      {t.venue_checked_in_at && <p className="mt-0.5 text-xs">{formatDateTime(t.venue_checked_in_at)}{t.venue_checked_in_by ? ` oleh ${t.venue_checked_in_by}` : ''}</p>}
                    </div>
                  ) : (
                    <button onClick={() => void lookup(payload, 'confirm')} className="w-full rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white sm:w-auto">
                      Tandai Masuk Venue
                    </button>
                  )}
                </div>
              )
            })()}

            {result.tipe === 'po' && (() => {
              const po = result.po
              const sisa = Math.max(0, Number(po.total) - Number(po.sudah_dibayar ?? 0))
              return (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{po.no_po}</h3>
                      <p className="text-sm text-slate-500">{po.nama_pemesan} · {po.tipe_pemesan}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      po.status === 'lunas'
                        ? 'bg-green-100 text-green-800'
                        : po.status === 'ditolak' || po.status === 'batal'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                    }`}>
                      {statusPesananLabel(po.status)}
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Item</th>
                          <th className="px-3 py-2">Ukuran</th>
                          <th className="px-3 py-2 text-center">Qty</th>
                          <th className="px-3 py-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {po.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2 text-slate-900">{item.merchandise?.nama || 'Merchandise'}</td>
                            <td className="px-3 py-2 text-slate-600">{item.varian?.nama || item.ukuran || '-'}</td>
                            <td className="px-3 py-2 text-center text-slate-600">{item.qty}</td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-900">
                              {formatRupiah(Number(item.subtotal))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs sm:gap-y-3 sm:p-4 sm:text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Kontak</dt>
                      <dd className="font-medium text-slate-900">{po.kontak || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Waktu Pesan</dt>
                      <dd className="text-slate-900">{formatDateTime(po.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Total</dt>
                      <dd className="font-semibold text-slate-900">{formatRupiah(Number(po.total))}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Sudah Dibayar</dt>
                      <dd className="font-medium text-green-700">{formatRupiah(Number(po.sudah_dibayar ?? 0))}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Sisa</dt>
                      <dd className="font-medium text-orange-600">{formatRupiah(sisa)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Metode</dt>
                      <dd className="text-slate-900">
                        {po.pembayaran_metode
                          ? `${po.pembayaran_metode} · ${po.pembayaran_tipe === 'nyicil' ? 'Nyicil' : 'Lunas'}`
                          : '-'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Status Pengambilan</dt>
                      <dd className="text-slate-900">
                        {po.picked_up_at ? `Sudah diambil ${formatDateTime(po.picked_up_at)}` : 'Belum diambil'}
                      </dd>
                    </div>
                    {po.catatan_admin && (
                      <div className="col-span-2">
                        <dt className="text-xs text-slate-500">Catatan Admin</dt>
                        <dd className="text-slate-900">{po.catatan_admin}</dd>
                      </div>
                    )}
                  </dl>

                  <button
                    onClick={() => void lookup(payload, 'confirm')}
                    disabled={result.sudahDiambil}
                    className="w-full rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
                  >
                    {result.sudahDiambil ? 'Sudah Diambil' : 'Tandai Sudah Diambil'}
                  </button>
                </div>
              )
            })()}

            {result.tipe === 'tiket' && (
              <div className="space-y-3 sm:space-y-4">
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
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs [&_dd]:break-words sm:gap-x-4 sm:gap-y-3 sm:p-4 sm:text-sm">
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
                      <div className="col-span-2">
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

            {sudah && result.tipe !== 'tenant' && <p className="mt-2 text-xs text-slate-500">Data ini sudah pernah dikonfirmasi.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
