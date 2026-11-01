'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import type { Tenant, Pembayaran, PeriodeHarga } from '@/lib/types'
import { formatRupiah, formatDate } from '@/lib/utils'
import { STATUS_LABEL, STATUS_COLOR, periodeLabel, hitungHariTersisa, hitungMinimalCicilan, tambahHari } from '@/lib/types'
import { getJSON, sendJSON, bustCache } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import { useConfirm } from '@/components/confirm-dialog'

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const confirm = useConfirm()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [pembayaran, setPembayaran] = useState<Pembayaran[]>([])
  const [periods, setPeriods] = useState<PeriodeHarga[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    tanggal_bayar: new Date().toISOString().slice(0, 10),
    jenis: 'Cicilan', nominal: '', metode: 'Transfer', no_ref: '', keterangan: '',
  })
  const [file, setFile] = useState<File | null>(null)
  const initialized = useRef(false)

  const load = useCallback(async () => {
    const [t, p, pr] = await Promise.all([
      getJSON<Tenant>(`/api/tenants/${id}`),
      getJSON<Pembayaran[]>(`/api/pembayaran?tenant_id=${id}`),
      getJSON<PeriodeHarga[]>('/api/master/periode'),
    ])
    setTenant(t); setPembayaran(p); setPeriods(pr)
    if (!initialized.current) {
      initialized.current = true
      if (t.sudah_dibayar === 0) {
        setForm((f) => ({ ...f, jenis: 'DP', nominal: String(t.dp_wajib) }))
      }
    }
  }, [id])

  useEffect(() => {
    load().catch((e) => toast.error(e.message)).finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!tenant) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('tenant_id', tenant.id)
      fd.append('tanggal_bayar', form.tanggal_bayar)
      fd.append('jenis', form.jenis)
      fd.append('nominal', form.nominal)
      fd.append('metode', form.metode)
      fd.append('no_ref', form.no_ref)
      fd.append('keterangan', form.keterangan)
      if (file) fd.append('bukti', file)

      const res = await fetch('/api/pembayaran', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan')
      bustCache()

      if (form.jenis === 'DP' && !tenant.tgl_dp) {
        await sendJSON(`/api/tenants/${tenant.id}`, 'PATCH', { tgl_dp: form.tanggal_bayar })
      }
      toast.success('Pembayaran dicatat')
      setForm({ ...form, nominal: '', no_ref: '', keterangan: '' })
      setFile(null)
      await load()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function hapusBayar(pid: string) {
    const ok = await confirm({
      title: 'Hapus pembayaran?',
      description: 'Data pembayaran ini akan dihapus permanen.',
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      await sendJSON(`/api/pembayaran/${pid}`, 'DELETE')
      toast.success('Pembayaran dihapus')
      await load()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (loading) return <PageSkeleton />
  if (!tenant) return <p className="text-red-600">Tenant tidak ditemukan.</p>

  const sisa = Math.max(0, tenant.harga_akhir - tenant.sudah_dibayar)
  const hariTersisa = tenant.tgl_dp && tenant.tgl_acara ? hitungHariTersisa(tenant.tgl_acara, tenant.tgl_dp) : 0
  const minimal = hitungMinimalCicilan(hariTersisa, sisa)

  const info = [
    ['Kode Stand', tenant.kode_stand],
    ['Kontak', tenant.kontak],
    ['Email', tenant.email ?? '-'],
    ['Kategori', tenant.kategori_sewa?.nama ?? '-'],
    ['Jenis Usaha', tenant.jenis_usaha],
    ['Asal', tenant.asal],
    ['Lokasi', tenant.lokasi],
    ['Periode', periodeLabel(tenant.periode_daftar, periods)],
    ['Harga Akhir', formatRupiah(tenant.harga_akhir)],
    ['DP Wajib', formatRupiah(tenant.dp_wajib)],
    ['Sudah Dibayar', formatRupiah(tenant.sudah_dibayar)],
    ['Tgl Daftar', formatDate(tenant.tgl_daftar)],
    ['Tgl DP', tenant.tgl_dp ? formatDate(tenant.tgl_dp) : '-'],
    ['Tgl Acara', tenant.tgl_acara ? formatDate(tenant.tgl_acara) : '-'],
  ]

  const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10 text-sm'
  const label = 'block text-sm font-medium mb-1'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dankelola/tenants" className="text-sm text-primary-600">← Kembali</Link>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{tenant.nama_usaha}</h1>
        <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[tenant.status]}`}>{STATUS_LABEL[tenant.status]}</span>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <h2 className="font-semibold mb-3">Data Tenant</h2>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {info.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-slate-100 pb-1">
                <dt className="text-slate-500">{k}</dt><dd className="font-medium text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 space-y-2 text-sm">
          <h2 className="font-semibold mb-1">Cicilan</h2>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-primary-600 transition-all"
              style={{ width: `${Math.min(100, Math.round((tenant.sudah_dibayar / tenant.harga_akhir) * 100))}%` }}
            />
          </div>
          <div className="flex justify-between pt-1"><span className="text-slate-500">Terbayar</span><span className="font-semibold">{Math.min(100, Math.round((tenant.sudah_dibayar / tenant.harga_akhir) * 100))}%</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Sisa</span><span className="font-semibold text-orange-600">{formatRupiah(sisa)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Hari Tersisa</span><span className="font-bold">{hariTersisa} hari</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Minimal/Hari</span><span className="font-bold text-primary-600">{formatRupiah(minimal)}</span></div>
          {tenant.tgl_dp && (
            <div className="flex justify-between"><span className="text-slate-500">Cicilan Mulai</span><span className="font-medium">{formatDate(tambahHari(tenant.tgl_dp, 1))}</span></div>
          )}
          {sisa > 0 && hariTersisa === 0 && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              Hari H sudah tiba / tanggal DP belum diisi — sisa tagihan belum bisa dicicil harian.
            </p>
          )}
          <p className="text-xs text-slate-400 pt-2">Minimal cicilan = sisa tagihan ÷ hari tersisa (H+1 DP s/d Hari H, dibulatkan ke atas).</p>
        </div>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40 grid md:grid-cols-3 gap-3">
        <div><label className={label}>Tanggal</label><input type="date" required className={input} value={form.tanggal_bayar} onChange={(e) => setForm({ ...form, tanggal_bayar: e.target.value })} /></div>
        <div>
          <label className={label}>Jenis</label>
          <select className={input} value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })}>
            <option>DP</option><option>Cicilan</option><option>Pelunasan</option>
          </select>
        </div>
        <div><label className={label}>Nominal</label><input type="number" required min={1} className={input} placeholder="cth: 500000" value={form.nominal} onChange={(e) => setForm({ ...form, nominal: e.target.value })} /></div>
        <div><label className={label}>Metode</label><input className={input} placeholder="cth: Transfer BCA" value={form.metode} onChange={(e) => setForm({ ...form, metode: e.target.value })} /></div>
        <div><label className={label}>No Ref</label><input className={input} placeholder="cth: 123456789" value={form.no_ref} onChange={(e) => setForm({ ...form, no_ref: e.target.value })} /></div>
        <div><label className={label}>Bukti (jpg/png/webp/pdf)</label><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className={input} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        <div className="md:col-span-3"><label className={label}>Keterangan</label><input className={input} placeholder="Catatan (opsional)" value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} /></div>
        <div className="md:col-span-3 flex justify-end">
          <button disabled={saving} className="bg-primary-600 text-white px-6 py-2.5.5 rounded-xl font-medium transition-all hover:bg-primary-700 hover:shadow-sm hover:shadow-primary-600/20 text-sm disabled:opacity-50">{saving ? 'Menyimpan...' : 'Catat Pembayaran'}</button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr><th className="px-6 py-3">No</th><th className="px-6 py-3">Tanggal</th><th className="px-6 py-3">Jenis</th><th className="px-6 py-3">Nominal</th><th className="px-6 py-3">Metode</th><th className="px-6 py-3">Bukti</th><th className="px-6 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {pembayaran.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Belum ada pembayaran.</td></tr>}
            {pembayaran.map((p) => (
              <tr key={p.id}>
                <td className="px-6 py-3 font-mono text-xs">{p.no_transaksi}</td>
                <td className="px-6 py-3">{formatDate(p.tanggal_bayar)}</td>
                <td className="px-6 py-3">{p.jenis}</td>
                <td className="px-6 py-3">{formatRupiah(p.nominal)}</td>
                <td className="px-6 py-3">{p.metode}</td>
                <td className="px-6 py-3">{p.bukti_url ? <a href={p.bukti_url} target="_blank" className="text-primary-600 text-xs">Lihat</a> : '-'}</td>
                <td className="px-6 py-3 text-right"><button onClick={() => hapusBayar(p.id)} className="text-red-600 text-xs hover:underline">Hapus</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
