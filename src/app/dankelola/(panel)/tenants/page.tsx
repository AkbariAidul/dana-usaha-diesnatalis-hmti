'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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

const emptyForm = {
  nama_usaha: '', kontak: '', email: '',
  kategori_sewa_id: '', jenis_usaha: 'F&B' as 'F&B' | 'Non-F&B',
  tgl_daftar: today,
  tgl_acara: '', keterangan: '',
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

  const pendingDaftar = pendaftaran.filter((p) => p.status === 'menunggu_verifikasi')
  const pendingBayar = pembayaran.filter((p) => !p.validated)

  const filtered = tenants.filter(
    (t) => !q || t.nama_usaha.toLowerCase().includes(q.toLowerCase()) || t.kode_stand.toLowerCase().includes(q.toLowerCase())
  )

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

      {pendingDaftar.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-amber-200 bg-amber-50/40 shadow-sm">
          <div className="flex items-center justify-between px-5 py-3">
            <h2 className="font-semibold text-slate-900">Verifikasi Pendaftaran</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{pendingDaftar.length} menunggu</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-amber-100/60 text-left text-xs text-slate-600">
              <tr>
                <th className="px-5 py-2">Kode</th><th className="px-5 py-2">Usaha</th><th className="px-5 py-2">Kategori</th>
                <th className="px-5 py-2">Kontak</th><th className="px-5 py-2">Harga</th><th className="px-5 py-2">DP</th>
                <th className="px-5 py-2">Bukti</th><th className="px-5 py-2">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {pendingDaftar.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-2 font-mono text-xs">{p.kode_pendaftaran}</td>
                  <td className="px-5 py-2 font-medium">{p.nama_usaha}</td>
                  <td className="px-5 py-2">{kategori.find((k) => k.id === p.kategori_sewa_id)?.nama ?? '-'}</td>
                  <td className="px-5 py-2">{p.kontak}</td>
                  <td className="px-5 py-2">{formatRupiah(Number(p.harga_akhir))}</td>
                  <td className="px-5 py-2">{formatRupiah(Number(p.dp_wajib))}</td>
                  <td className="px-5 py-2">
                    {p.bukti_url ? <a href={p.bukti_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">Lihat</a> : '-'}
                  </td>
                  <td className="px-5 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => verifikasiPendaftaran(p, 'dp_diterima', null)} className="rounded bg-green-600 px-2 py-1 text-xs text-white">Terima</button>
                      <button onClick={() => { setRejectCatatan(''); setRejectDaftar(p) }} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Tolak</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingBayar.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-blue-200 bg-blue-50/40 shadow-sm">
          <div className="flex items-center justify-between px-5 py-3">
            <h2 className="font-semibold text-slate-900">Verifikasi Pembayaran</h2>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">{pendingBayar.length} menunggu</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-blue-100/60 text-left text-xs text-slate-600">
              <tr>
                <th className="px-5 py-2">Tanggal</th><th className="px-5 py-2">Tenant</th><th className="px-5 py-2">Jenis</th>
                <th className="px-5 py-2">Nominal</th><th className="px-5 py-2">Metode</th><th className="px-5 py-2">Bukti</th><th className="px-5 py-2">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100">
              {pendingBayar.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-2 text-slate-500">{formatDate(p.tanggal_bayar)}</td>
                  <td className="px-5 py-2">
                    <Link href={`/dankelola/tenants/${p.tenant_id}`} className="text-primary-600 hover:underline">
                      {p.tenants?.nama_usaha ?? tenants.find((t) => t.id === p.tenant_id)?.nama_usaha ?? '-'}
                    </Link>
                  </td>
                  <td className="px-5 py-2">{p.jenis}</td>
                  <td className="px-5 py-2 font-medium">{formatRupiah(p.nominal)}</td>
                  <td className="px-5 py-2 text-slate-500">{p.metode || '-'}</td>
                  <td className="px-5 py-2">
                    {p.bukti_url ? <a href={p.bukti_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">Lihat</a> : '-'}
                  </td>
                  <td className="px-5 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => verifikasiPembayaran(p, 'approve')} className="rounded bg-green-600 px-2 py-1 text-xs text-white">Setujui</button>
                      <button onClick={() => verifikasiPembayaran(p, 'reject')} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Tolak</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-6 py-3">Kode</th><th className="px-6 py-3">Nama</th><th className="px-6 py-3">Kategori</th>
              <th className="px-6 py-3">Harga</th><th className="px-6 py-3">Dibayar</th><th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Daftar</th><th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {loading && <TableSkeleton rows={5} cols={8} />}
            {!loading && filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Belum ada tenant.</td></tr>}
            {filtered.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 font-mono text-xs">{t.kode_stand}</td>
                <td className="px-6 py-3"><Link href={`/dankelola/tenants/${t.id}`} className="text-primary-600 hover:underline">{t.nama_usaha}</Link></td>
                <td className="px-6 py-3">{t.kategori_sewa?.nama ?? '-'}</td>
                <td className="px-6 py-3">{formatRupiah(t.harga_akhir)}</td>
                <td className="px-6 py-3">{formatRupiah(t.sudah_dibayar)}</td>
                <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[t.status]}`}>{STATUS_LABEL[t.status]}</span></td>
                <td className="px-6 py-3 text-slate-500">{formatDate(t.tgl_daftar)}</td>
                <td className="px-6 py-3 text-right">
                  <button onClick={() => hapus(t.id)} className="text-red-600 hover:underline text-xs">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
