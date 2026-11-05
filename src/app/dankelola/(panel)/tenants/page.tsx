'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { toast } from 'sonner'
import type { Tenant, KategoriSewa, HargaDasar, PeriodeHarga, Pembayaran } from '@/lib/types'
import { formatRupiah, formatDate } from '@/lib/utils'
import { STATUS_LABEL, STATUS_COLOR, periodeDariTanggal, periodeLabel } from '@/lib/types'
import { kategoriTenant, lokasiUntukKategori } from '@/lib/tenant'
import { getJSON, sendJSON } from '../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { TableSkeleton } from '../ui'
import { useConfirm } from '@/components/confirm-dialog'
import { Modal } from '@/components/modal'

const today = new Date().toISOString().slice(0, 10)

const emptyForm = {
  nama_usaha: '', kontak: '', email: '',
  kategori_sewa_id: '', jenis_usaha: 'F&B' as 'F&B' | 'Non-F&B',
  tgl_daftar: today,
  tgl_acara: '', keterangan: '',
}

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
  status: string
  tanggal: string
  detailId?: string
  pendaftaran?: Pendaftaran
  pendingBayar: Pembayaran[]
}

export default function TenantsPage() {
  const confirm = useConfirm()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [pendaftaran, setPendaftaran] = useState<Pendaftaran[]>([])
  const [pembayaran, setPembayaran] = useState<Pembayaran[]>([])
  const [kategori, setKategori] = useState<KategoriSewa[]>([])
  const [hargaDasar, setHargaDasar] = useState<HargaDasar[]>([])
  const [periods, setPeriods] = useState<PeriodeHarga[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [rejectDaftar, setRejectDaftar] = useState<Pendaftaran | null>(null)
  const [rejectCatatan, setRejectCatatan] = useState('')

  async function load() {
    const [t, m, d, p] = await Promise.all([
      getJSON<Tenant[]>('/api/tenants'),
      getJSON<{ kategori: KategoriSewa[]; hargaDasar: HargaDasar[]; periode: PeriodeHarga[] }>('/api/master'),
      getJSON<Pendaftaran[]>('/api/public/tenant'),
      getJSON<Pembayaran[]>('/api/pembayaran'),
    ])
    setTenants(t); setKategori(kategoriTenant(m.kategori || [])); setHargaDasar(m.hargaDasar); setPeriods(m.periode || [])
    setPendaftaran(d); setPembayaran(p)
  }

  useEffect(() => {
    load().catch((e) => toast.error(e.message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => { setPage(1) }, [q, filterStatus])
  useLiveRefresh(load)

  const periode = periodeDariTanggal(form.tgl_daftar, periods)

  const harga = useMemo(() => {
    const hd = hargaDasar.find(
      (h) => h.kategori_sewa_id === form.kategori_sewa_id && h.jenis_usaha === form.jenis_usaha && h.periode === periode
    ) ?? hargaDasar.find((h) => h.kategori_sewa_id === form.kategori_sewa_id && h.periode === periode)
    return Number(hd?.harga ?? 0)
  }, [form.kategori_sewa_id, form.jenis_usaha, hargaDasar, periode])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!periode) { toast.error('Tanggal daftar di luar periode open tenant'); return }
    setSaving(true)
    try {
      const selectedKategori = kategori.find((k) => k.id === form.kategori_sewa_id)
      await sendJSON('/api/tenants', 'POST', {
        ...form,
        email: form.email || null,
        asal: 'Internal Kampus',
        lokasi: lokasiUntukKategori(selectedKategori?.kode),
        addon: [],
        periode_daftar: periode,
        tgl_dp: null,
        tgl_acara: form.tgl_acara || null,
        harga_akhir: harga,
        dp_wajib: Math.ceil(harga / 2),
        status: 'daftar',
        sudah_dibayar: 0,
      })
      toast.success('Tenant ditambahkan')
      setForm(emptyForm); setShowForm(false)
      await load()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

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
        status: p.status,
        tanggal: p.created_at,
        pendaftaran: p,
        pendingBayar: [],
      })),
    ...tenants.map((t) => {
      const pending = pendingBayar.filter((p) => p.tenant_id === t.id)
      return {
        key: `tenant-${t.id}`,
        kind: 'tenant' as const,
        kode: t.kode_stand,
        nama_usaha: t.nama_usaha,
        kontak: t.kontak,
        kategori: t.kategori_sewa?.nama ?? kategoriNama(t.kategori_sewa_id),
        harga: Number(t.harga_akhir),
        dibayar: Number(t.sudah_dibayar),
        status: t.status,
        tanggal: t.tgl_daftar,
        detailId: t.id,
        pendingBayar: pending,
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

  const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10 text-sm'
  const label = 'block text-sm font-medium mb-1'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tenant</h1>
        <div className="flex gap-2">
          <input placeholder="Cari nama / kode" value={q} onChange={(e) => setQ(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10 text-sm" />
          <button onClick={() => setShowForm(!showForm)} className="bg-primary-600 text-white px-6 py-2.5.5 rounded-xl font-medium transition-all hover:bg-primary-700 hover:shadow-sm hover:shadow-primary-600/20 text-sm hover:bg-primary-700">
            {showForm ? 'Tutup' : '+ Tambah'}
          </button>
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

      {showForm && (
        <form onSubmit={submit} className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 grid md:grid-cols-2 gap-3">
          <div><label className={label}>Nama Usaha</label><input required className={input} placeholder="cth: Kopi Senja" value={form.nama_usaha} onChange={(e) => setForm({ ...form, nama_usaha: e.target.value })} /></div>
          <div><label className={label}>Kontak (WA)</label><input required className={input} placeholder="08xxxxxxxxxx" value={form.kontak} onChange={(e) => setForm({ ...form, kontak: e.target.value })} /></div>
          <div><label className={label}>Email (opsional)</label><input type="email" className={input} placeholder="nama@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div>
            <label className={label}>Kategori Sewa</label>
            <select required className={input} value={form.kategori_sewa_id} onChange={(e) => setForm({ ...form, kategori_sewa_id: e.target.value })}>
              <option value="">Pilih kategori</option>
              {kategori.map((k) => <option key={k.id} value={k.id}>{k.kode} - {k.nama}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Jenis Usaha</label>
            <select className={input} value={form.jenis_usaha} onChange={(e) => setForm({ ...form, jenis_usaha: e.target.value as 'F&B' | 'Non-F&B' })}>
              <option value="F&B">F&B</option><option value="Non-F&B">Non-F&B</option>
            </select>
          </div>
          <div><label className={label}>Tanggal Daftar</label><input type="date" required className={input} value={form.tgl_daftar} onChange={(e) => setForm({ ...form, tgl_daftar: e.target.value })} /></div>
          <div>
            <label className={label}>Periode (otomatis)</label>
            <div className={`${input} bg-slate-50 ${periode ? 'text-slate-900' : 'text-red-600'}`}>
              {periode ? periodeLabel(periode, periods) : 'Di luar periode open tenant'}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {periods.map((p) => `${p.nama} ${formatDate(p.tanggal_mulai)}–${formatDate(p.tanggal_selesai)}`).join(' · ')}
            </p>
          </div>
          <div><label className={label}>Tanggal Acara (opsional)</label><input type="date" className={input} value={form.tgl_acara} onChange={(e) => setForm({ ...form, tgl_acara: e.target.value })} /></div>
          <div><label className={label}>Keterangan</label><input className={input} placeholder="Catatan (opsional)" value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} /></div>
          <div className="md:col-span-2 flex items-center justify-between border-t pt-3">
            <div className="text-sm">
              Harga: <span className="font-semibold text-primary-600">{formatRupiah(harga)}</span>
              <span className="text-slate-500"> · DP 50%: {formatRupiah(Math.ceil(harga / 2))}</span>
            </div>
            <button disabled={saving} className="bg-primary-600 text-white px-6 py-2.5.5 rounded-xl font-medium transition-all hover:bg-primary-700 hover:shadow-sm hover:shadow-primary-600/20 text-sm disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Data Tenant</h2>
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

        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3">Kode</th>
              <th className="px-5 py-3">Tenant</th>
              <th className="px-5 py-3">Kategori</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3 text-right">Dibayar</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Pembayaran</th>
              <th className="px-5 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {loading && <TableSkeleton rows={5} cols={8} />}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-6 text-center text-slate-400">
                {rows.length === 0 ? 'Belum ada tenant.' : 'Tidak ada tenant yang cocok.'}
              </td></tr>
            )}
            {paginated.map((r) => (
              <tr key={r.key} className="hover:bg-slate-50">
                <td className="px-5 py-3 align-top">
                  <div className="font-mono text-xs">{r.kode}</div>
                  <div className="mt-1 text-xs text-slate-400">{formatDate(r.tanggal)}</div>
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
                <td className="px-5 py-3 align-top text-right tabular-nums">{formatRupiah(r.dibayar)}</td>
                <td className="px-5 py-3 align-top">
                  {r.kind === 'pendaftaran' ? (
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${r.status === 'ditolak' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {r.status === 'ditolak' ? 'Ditolak' : 'Menunggu Verifikasi'}
                    </span>
                  ) : (
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_COLOR[r.status]}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                  )}
                </td>
                <td className="px-5 py-3 align-top">
                  {r.kind === 'pendaftaran' ? (
                    r.pendaftaran?.bukti_url ? (
                      <a href={r.pendaftaran.bukti_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">Bukti DP</a>
                    ) : <span className="text-xs text-slate-400">—</span>
                  ) : r.pendingBayar.length === 0 ? (
                    <span className="text-xs text-slate-400">—</span>
                  ) : (
                    <div className="space-y-1.5">
                      {r.pendingBayar.map((p) => (
                        <div key={p.id} className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-slate-700">{p.jenis} · {formatRupiah(p.nominal)}</span>
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
                </td>
                <td className="px-5 py-3 align-top">
                  {r.kind === 'pendaftaran' && r.pendaftaran ? (
                    <div className="flex flex-wrap gap-1">
                      <button onClick={() => verifikasiPendaftaran(r.pendaftaran!, 'dp_diterima', null)} className="rounded bg-green-600 px-2 py-1 text-xs text-white">Terima</button>
                      <button onClick={() => { setRejectCatatan(''); setRejectDaftar(r.pendaftaran!) }} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Tolak</button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
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
