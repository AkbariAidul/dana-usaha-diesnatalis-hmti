'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { toast } from 'sonner'
import type { Tenant, KategoriSewa, Pembayaran, TenantAddon } from '@/lib/types'
import { formatRupiah, formatDate, formatDateTime } from '@/lib/utils'
import { STATUS_LABEL, STATUS_COLOR } from '@/lib/types'
import { kategoriTenant } from '@/lib/tenant'
import { getJSON, sendJSON } from '../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { TableSkeleton } from '../ui'
import { useConfirm } from '@/components/confirm-dialog'
import { Modal } from '@/components/modal'
import { QrImage } from '@/components/qr-image'

type Pendaftaran = {
  id: string
  kode_pendaftaran: string
  nama_usaha: string
  kontak: string
  email: string | null
  kategori_sewa_id: string
  harga_akhir: number
  dp_wajib: number
  status: string
  bukti_url: string | null
  created_at: string
  jumlah_tenant?: number | null
  addon?: TenantAddon[] | null
}

type Row = {
  key: string
  kind: 'pendaftaran' | 'tenant'
  kode: string
  nama_usaha: string
  kontak: string
  kategori: string
  harga: number
  dibayar: number
  sisa: number
  status: string
  tanggal: string
  jumlahTenant: number
  addon?: TenantAddon[] | null
  checkedInAt?: string | null
  detailId?: string
  pendaftaran?: Pendaftaran
  pendingBayar: Pembayaran[]
  payments: Pembayaran[]
  qr?: string | null
}

export default function TenantsPage() {
  const confirm = useConfirm()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [pendaftaran, setPendaftaran] = useState<Pendaftaran[]>([])
  const [pembayaran, setPembayaran] = useState<Pembayaran[]>([])
  const [kategori, setKategori] = useState<KategoriSewa[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [rejectDaftar, setRejectDaftar] = useState<Pendaftaran | null>(null)
  const [rejectCatatan, setRejectCatatan] = useState('')
  const [strukTarget, setStrukTarget] = useState<Row | null>(null)
  const [riwayatTerbuka, setRiwayatTerbuka] = useState<string | null>(null)
  const [qrPreview, setQrPreview] = useState<string | null>(null)

  async function load() {
    const [t, m, d, p] = await Promise.all([
      getJSON<Tenant[]>('/api/tenants'),
      getJSON<{ kategori: KategoriSewa[] }>('/api/master'),
      getJSON<Pendaftaran[]>('/api/public/tenant'),
      getJSON<Pembayaran[]>('/api/pembayaran'),
    ])
    setTenants(t); setKategori(kategoriTenant(m.kategori || [], true))
    setPendaftaran(d); setPembayaran(p)
  }

  useEffect(() => {
    load().catch((e) => toast.error(e.message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => { setPage(1) }, [q, filterStatus])
  useLiveRefresh(load)

  async function hapus(id: string) {
    const ok = await confirm({
      title: 'Hapus tenant?',
      description: 'Tenant ini dan semua data terkait bisa ikut terhapus permanen.',
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      await sendJSON(`/api/tenants/${id}`, 'DELETE')
      toast.success('Tenant dihapus')
      await load()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function verifikasiPendaftaran(item: Pendaftaran, status: 'dp_diterima' | 'ditolak', catatan: string | null) {
    if (status === 'dp_diterima') {
      const ok = await confirm({
        title: 'Terima pendaftaran?',
        description: `${item.nama_usaha} (${item.kode_pendaftaran}) akan dibuat menjadi tenant dan DP dicatat.`,
        confirmText: 'Terima',
        danger: false,
      })
      if (!ok) return
    }
    try {
      await sendJSON(`/api/public/tenant/${item.id}/verifikasi`, 'POST', { status, catatan_admin: catatan })
      toast.success(status === 'dp_diterima' ? 'Pendaftaran diterima' : 'Pendaftaran ditolak')
      setRejectDaftar(null); setRejectCatatan('')
      await load()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function tolakPendaftaran() {
    if (!rejectDaftar) return
    const catatan = rejectCatatan.trim()
    if (!catatan) { toast.error('Alasan penolakan wajib diisi'); return }
    await verifikasiPendaftaran(rejectDaftar, 'ditolak', catatan)
  }

  async function verifikasiPembayaran(item: Pembayaran, action: 'approve' | 'reject') {
    const ok = await confirm({
      title: action === 'approve' ? 'Setujui pembayaran?' : 'Tolak pembayaran?',
      description: action === 'approve'
        ? `Pembayaran ${formatRupiah(item.nominal)} akan diverifikasi.`
        : `Pembayaran ${formatRupiah(item.nominal)} akan dihapus permanen.`,
      confirmText: action === 'approve' ? 'Setujui' : 'Tolak',
      danger: action === 'reject',
    })
    if (!ok) return
    try {
      await sendJSON(`/api/pembayaran/${item.id}`, 'PATCH', { action })
      toast.success(action === 'approve' ? 'Pembayaran diverifikasi' : 'Pembayaran ditolak')
      await load()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const kategoriNama = (id: string) => kategori.find((k) => k.id === id)?.nama ?? '-'
  const pendingBayar = pembayaran.filter((p) => !p.validated)

  const rows: Row[] = [
    ...pendaftaran
      .filter((p) => p.status !== 'dp_diterima')
      .map((p) => ({
        key: `daftar-${p.id}`,
        kind: 'pendaftaran' as const,
        kode: p.kode_pendaftaran,
        nama_usaha: p.nama_usaha,
        kontak: p.kontak,
        kategori: kategoriNama(p.kategori_sewa_id),
        harga: Number(p.harga_akhir),
        dibayar: 0,
        sisa: Number(p.harga_akhir),
        status: p.status,
        tanggal: p.created_at,
        jumlahTenant: Number(p.jumlah_tenant ?? 1),
        addon: p.addon ?? null,
        pendaftaran: p,
        pendingBayar: [],
        payments: [],
        qr: null,
      })),
    ...tenants.map((t) => {
      const pending = pendingBayar.filter((p) => p.tenant_id === t.id)
      const harga = Number(t.harga_akhir)
      const dibayar = Number(t.sudah_dibayar)
      return {
        key: `tenant-${t.id}`,
        kind: 'tenant' as const,
        kode: t.kode_stand,
        nama_usaha: t.nama_usaha,
        kontak: t.kontak,
        kategori: t.kategori_sewa?.nama ?? kategoriNama(t.kategori_sewa_id),
        harga,
        dibayar,
        sisa: Math.max(0, harga - dibayar),
        status: t.status,
        tanggal: t.tgl_daftar,
        jumlahTenant: Number(t.jumlah_tenant ?? 1),
        addon: t.addon ?? null,
        checkedInAt: t.venue_checked_in_at ?? null,
        detailId: t.id,
        pendingBayar: pending,
        payments: pembayaran.filter((p) => p.tenant_id === t.id),
        qr: t.qr ?? null,
      }
    }),
  ]

  const menunggu = pendaftaran.filter((p) => p.status === 'menunggu_verifikasi').length
  const ditolak = pendaftaran.filter((p) => p.status === 'ditolak').length
  const keyword = q.trim().toLowerCase()
  const filtered = rows.filter((r) => {
    if (filterStatus === 'menunggu') {
      const daftarMenunggu = r.kind === 'pendaftaran' && r.status === 'menunggu_verifikasi'
      if (!daftarMenunggu && r.pendingBayar.length === 0) return false
    }
    if (filterStatus === 'aktif' && r.kind !== 'tenant') return false
    if (filterStatus === 'ditolak' && r.status !== 'ditolak') return false
    if (!keyword) return true
    return [r.kode, r.nama_usaha, r.kontak, r.kategori].some((v) => v.toLowerCase().includes(keyword))
  })
  const PER_PAGE = 10
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)
  const strukAddonTotal = (strukTarget?.addon ?? []).reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0)
  const strukPaketSubtotal = Math.max(0, Number(strukTarget?.harga ?? 0) - strukAddonTotal)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Data Tenant</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter status"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-400 focus:outline-none"
          >
            <option value="all">Semua ({rows.length})</option>
            <option value="menunggu">Menunggu Verifikasi ({menunggu + pendingBayar.length})</option>
            <option value="aktif">Tenant Aktif ({tenants.length})</option>
            <option value="ditolak">Ditolak ({ditolak})</option>
          </select>
          <div className="relative w-full min-w-[12rem] sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama / kode / kontak..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 focus:border-primary-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Tenant Aktif</p>
          <p className="text-3xl font-bold text-primary-600">{tenants.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Menunggu Verifikasi</p>
          <p className="text-3xl font-bold text-yellow-600">{menunggu}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Pembayaran Pending</p>
          <p className="text-3xl font-bold text-blue-600">{pendingBayar.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Ditolak</p>
          <p className="text-3xl font-bold text-red-600">{ditolak}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3">Kode</th>
              <th className="px-5 py-3">Tenant</th>
              <th className="px-5 py-3">Kategori</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3 text-right">Dibayar</th>
              <th className="px-5 py-3 text-right">Sisa</th>
              <th className="px-5 py-3">Check-in Venue</th>
              <th className="px-5 py-3">Pembayaran</th>
              <th className="px-5 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {loading && <TableSkeleton rows={5} cols={9} />}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={9} className="px-5 py-6 text-center text-slate-400">
                {rows.length === 0 ? 'Belum ada tenant.' : 'Tidak ada tenant yang cocok.'}
              </td></tr>
            )}
            {paginated.map((r) => (
              <tr key={r.key} className="hover:bg-slate-50">
                <td className="px-5 py-3 align-top">
                  <div className="font-mono text-xs">{r.kode}</div>
                  <div className="mt-1 text-xs text-slate-400">{formatDate(r.tanggal)}</div>
                  {r.qr && (
                    <button
                      type="button"
                      onClick={() => setQrPreview(r.qr ?? null)}
                      className="mt-2 block rounded-md border border-slate-200 bg-white p-0.5 transition hover:ring-2 hover:ring-primary-200"
                      title="Perbesar QR masuk venue"
                    >
                      <QrImage value={r.qr} size={64} />
                    </button>
                  )}
                </td>
                <td className="px-5 py-3 align-top">
                  {r.detailId ? (
                    <Link href={`/dankelola/tenants/${r.detailId}`} className="font-medium text-primary-600 hover:underline">{r.nama_usaha}</Link>
                  ) : (
                    <div className="font-medium">{r.nama_usaha}</div>
                  )}
                  <div className="text-xs text-slate-500">{r.kontak}</div>
                </td>
                <td className="px-5 py-3 align-top">{r.kategori}</td>
                <td className="px-5 py-3 align-top text-right tabular-nums">{formatRupiah(r.harga)}</td>
                <td className="px-5 py-3 align-top text-right tabular-nums text-green-600">{formatRupiah(r.dibayar)}</td>
                <td className="px-5 py-3 align-top text-right tabular-nums text-orange-600">{formatRupiah(r.sisa)}</td>
                <td className="px-5 py-3 align-top">
                  {r.kind === 'pendaftaran' ? (
                    <span className="text-xs text-slate-400">—</span>
                  ) : r.checkedInAt ? (
                    <div>
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">Sudah Check-in</span>
                      <div className="mt-1 whitespace-nowrap text-xs text-slate-500">{formatDateTime(r.checkedInAt)}</div>
                    </div>
                  ) : (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Belum Check-in</span>
                  )}
                </td>
                <td className="px-5 py-3 align-top">
                  {r.kind === 'pendaftaran' ? (
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${r.status === 'ditolak' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {r.status === 'ditolak' ? 'Ditolak' : 'Menunggu Verifikasi'}
                    </span>
                  ) : (
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_COLOR[r.status]}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                  )}
                  <div className="mt-2">
                    {r.kind === 'pendaftaran' ? (
                      r.pendaftaran?.bukti_url ? (
                        <a href={r.pendaftaran.bukti_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">Bukti DP</a>
                      ) : <span className="text-xs text-slate-400">-</span>
                    ) : (
                      <>
                        <button
                          onClick={() => setRiwayatTerbuka(riwayatTerbuka === r.key ? null : r.key)}
                          className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
                        >
                          {r.payments.length} cicilan
                        </button>
                        {riwayatTerbuka === r.key && (
                          <div className="mt-2 space-y-1.5">
                            {r.payments.length === 0 && (
                              <p className="text-xs text-slate-400">Belum ada pembayaran.</p>
                            )}
                            {r.payments.map((p) => (
                              <div key={p.id} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-medium text-slate-700">{p.jenis} � {formatRupiah(Number(p.nominal))}</span>
                                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${p.validated ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {p.validated ? 'Terverifikasi' : 'Pending'}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                                  <span>{formatDate(p.tanggal_bayar)}</span>
                                  {p.bukti_url && <a href={p.bukti_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Bukti</a>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {r.pendingBayar.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            {r.pendingBayar.map((p) => (
                              <div key={p.id} className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-medium text-slate-700">{p.jenis} � {formatRupiah(p.nominal)}</span>
                                  {p.bukti_url && <a href={p.bukti_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">Bukti</a>}
                                </div>
                                <div className="mt-1 flex gap-1">
                                  <button onClick={() => verifikasiPembayaran(p, 'approve')} className="rounded bg-green-600 px-2 py-0.5 text-xs text-white">Setujui</button>
                                  <button onClick={() => verifikasiPembayaran(p, 'reject')} className="rounded bg-red-600 px-2 py-0.5 text-xs text-white">Tolak</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 align-top">
                  {r.kind === 'pendaftaran' && r.pendaftaran ? (
                    <div className="flex flex-wrap gap-1">
                      <button onClick={() => verifikasiPendaftaran(r.pendaftaran!, 'dp_diterima', null)} className="rounded bg-green-600 px-2 py-1 text-xs text-white">Terima</button>
                      <button onClick={() => { setRejectCatatan(''); setRejectDaftar(r.pendaftaran!) }} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Tolak</button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {r.status === 'lunas' && (
                        <button onClick={() => setStrukTarget(r)} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200">Struk</button>
                      )}
                      <Link href={`/dankelola/tenants/${r.detailId}`} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200">Detail</Link>
                      <button onClick={() => hapus(r.detailId!)} className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">Hapus</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Menampilkan {filtered.length === 0 ? 0 : (currentPage - 1) * PER_PAGE + 1}–{Math.min(currentPage * PER_PAGE, filtered.length)} dari {filtered.length} tenant
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Halaman sebelumnya"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium text-slate-600">{currentPage} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              aria-label="Halaman berikutnya"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={!!qrPreview}
        onClose={() => setQrPreview(null)}
        panelClassName="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-xl"
      >
        <p className="text-sm font-semibold text-slate-900">QR Masuk Venue</p>
        <div className="mx-auto mt-3 w-fit rounded-xl border border-slate-200 p-3">
          {qrPreview && <QrImage value={qrPreview} size={256} />}
        </div>
        <p className="mt-2 text-xs text-slate-500">Aktif karena pembayaran sudah minimal 80%.</p>
        <button
          type="button"
          onClick={() => setQrPreview(null)}
          className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Tutup
        </button>
      </Modal>

      <Modal open={!!strukTarget} onClose={() => setStrukTarget(null)} panelClassName="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        {strukTarget && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Struk {strukTarget.kode}</h2>
                <p className="text-sm text-slate-500">{strukTarget.nama_usaha} · {strukTarget.kategori}</p>
              </div>
              <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">Lunas</span>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 text-center">Qty</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-3 py-2">{strukTarget.kategori} (Tempat)</td>
                    <td className="px-3 py-2 text-center">{strukTarget.jumlahTenant}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(strukPaketSubtotal)}</td>
                  </tr>
                  {(strukTarget.addon ?? []).map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">{item.nama}</td>
                      <td className="px-3 py-2 text-center">{item.qty}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(Number(item.subtotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-semibold">{formatRupiah(strukTarget.harga)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Sudah Dibayar</span><span className="font-medium text-green-700">{formatRupiah(strukTarget.dibayar)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Sisa</span><span className="font-medium text-orange-600">{formatRupiah(strukTarget.sisa)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tanggal Daftar</span><span>{formatDate(strukTarget.tanggal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Kontak</span><span>{strukTarget.kontak}</span></div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStrukTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Tutup
              </button>
              <a
                href={`/api/tenants/${strukTarget.detailId}/struk`}
                className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Download PDF
              </a>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!rejectDaftar} onClose={() => setRejectDaftar(null)}>
        <h2 className="text-lg font-semibold text-slate-900">Tolak pendaftaran?</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pendaftaran {rejectDaftar?.kode_pendaftaran} atas nama {rejectDaftar?.nama_usaha} akan ditolak.
        </p>
        <label className="mb-1 mt-4 block text-xs font-medium text-slate-500">Alasan penolakan</label>
        <textarea
          rows={3}
          value={rejectCatatan}
          onChange={(e) => setRejectCatatan(e.target.value)}
          placeholder="Contoh: Bukti transfer tidak valid"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setRejectDaftar(null)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void tolakPendaftaran()}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
          >
            Tolak Pendaftaran
          </button>
        </div>
      </Modal>
    </div>
  )
}
