'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import type { Tenant, KategoriSewa, HargaDasar, FaktorHarga, PeriodeHarga } from '@/lib/types'
import { formatRupiah, formatDate } from '@/lib/utils'
import { STATUS_LABEL, STATUS_COLOR, hitungHarga, periodeDariTanggal, periodeLabel } from '@/lib/types'
import { getJSON, sendJSON } from '../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { TableSkeleton } from '../ui'

const today = new Date().toISOString().slice(0, 10)

const emptyForm = {
  nama_usaha: '', kontak: '', email: '',
  kategori_sewa_id: '', jenis_usaha: 'F&B' as 'F&B' | 'Non-F&B',
  asal: 'Internal Kampus' as 'Internal Kampus' | 'Eksternal',
  lokasi: 'Reguler' as 'Reguler' | 'Strategis 1' | 'Strategis 2',
  tgl_daftar: today,
  tgl_acara: '', keterangan: '',
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [kategori, setKategori] = useState<KategoriSewa[]>([])
  const [hargaDasar, setHargaDasar] = useState<HargaDasar[]>([])
  const [faktor, setFaktor] = useState<FaktorHarga[]>([])
  const [periods, setPeriods] = useState<PeriodeHarga[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState('')

  async function load() {
    const [t, m] = await Promise.all([
      getJSON<Tenant[]>('/api/tenants'),
      getJSON<{ kategori: KategoriSewa[]; hargaDasar: HargaDasar[]; faktor: FaktorHarga[]; periode: PeriodeHarga[] }>('/api/master'),
    ])
    setTenants(t); setKategori(m.kategori); setHargaDasar(m.hargaDasar); setFaktor(m.faktor); setPeriods(m.periode || [])
  }

  useEffect(() => {
    load().catch((e) => toast.error(e.message)).finally(() => setLoading(false))
  }, [])
  useLiveRefresh(load)

  const periode = periodeDariTanggal(form.tgl_daftar, periods)

  const harga = useMemo(() => {
    const hd = hargaDasar.find(
      (h) => h.kategori_sewa_id === form.kategori_sewa_id && h.jenis_usaha === form.jenis_usaha && h.periode === periode
    )
    if (!hd) return 0
    const fa = faktor.find((f) => f.tipe === 'asal' && f.nilai === form.asal)?.multiplier ?? 1
    const fl = faktor.find((f) => f.tipe === 'lokasi' && f.nilai === form.lokasi)?.multiplier ?? 1
    return hitungHarga(hd.harga, fa, fl)
  }, [form, hargaDasar, faktor, periode])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!periode) { toast.error('Tanggal daftar di luar periode open tenant'); return }
    setSaving(true)
    try {
      await sendJSON('/api/tenants', 'POST', {
        ...form,
        email: form.email || null,
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
    if (!confirm('Hapus tenant ini? Semua data terkait bisa ikut terhapus.')) return
    try {
      await sendJSON(`/api/tenants/${id}`, 'DELETE')
      toast.success('Tenant dihapus')
      await load()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const filtered = tenants.filter(
    (t) => !q || t.nama_usaha.toLowerCase().includes(q.toLowerCase()) || t.kode_stand.toLowerCase().includes(q.toLowerCase())
  )

  const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 text-sm'
  const label = 'block text-sm font-medium mb-1'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tenant</h1>
        <div className="flex gap-2">
          <Link href="/dankelola/tenants/verifikasi" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Verifikasi</Link>
          <input placeholder="Cari nama / kode" value={q} onChange={(e) => setQ(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 text-sm" />
          <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-6 py-2.5.5 rounded-xl font-medium transition-all hover:bg-indigo-700 hover:shadow-sm hover:shadow-indigo-600/20 text-sm hover:bg-indigo-700">
            {showForm ? 'Tutup' : '+ Tambah'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 grid md:grid-cols-2 gap-3">
          <div><label className={label}>Nama Usaha</label><input required className={input} value={form.nama_usaha} onChange={(e) => setForm({ ...form, nama_usaha: e.target.value })} /></div>
          <div><label className={label}>Kontak (WA)</label><input required className={input} value={form.kontak} onChange={(e) => setForm({ ...form, kontak: e.target.value })} /></div>
          <div><label className={label}>Email (opsional)</label><input type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
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
          <div>
            <label className={label}>Asal</label>
            <select className={input} value={form.asal} onChange={(e) => setForm({ ...form, asal: e.target.value as typeof form.asal })}>
              <option>Internal Kampus</option><option>Eksternal</option>
            </select>
          </div>
          <div>
            <label className={label}>Lokasi</label>
            <select className={input} value={form.lokasi} onChange={(e) => setForm({ ...form, lokasi: e.target.value as typeof form.lokasi })}>
              <option>Reguler</option><option>Strategis 1</option><option>Strategis 2</option>
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
          <div><label className={label}>Keterangan</label><input className={input} value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} /></div>
          <div className="md:col-span-2 flex items-center justify-between border-t pt-3">
            <div className="text-sm">
              Harga: <span className="font-semibold text-indigo-600">{formatRupiah(harga)}</span>
              <span className="text-slate-500"> · DP 50%: {formatRupiah(Math.ceil(harga / 2))}</span>
            </div>
            <button disabled={saving} className="bg-indigo-600 text-white px-6 py-2.5.5 rounded-xl font-medium transition-all hover:bg-indigo-700 hover:shadow-sm hover:shadow-indigo-600/20 text-sm disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
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
                <td className="px-6 py-3"><Link href={`/dankelola/tenants/${t.id}`} className="text-indigo-600 hover:underline">{t.nama_usaha}</Link></td>
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
    </div>
  )
}
