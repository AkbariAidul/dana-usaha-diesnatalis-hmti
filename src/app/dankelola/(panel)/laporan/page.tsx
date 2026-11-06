'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { PesananTiket, Tenant } from '@/lib/types'
import { STATUS_LABEL } from '@/lib/types'
import { formatDate, formatRupiah } from '@/lib/utils'
import { getJSON } from '../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../ui'

type JenisLaporan = 'tenant' | 'merchandise' | 'ticket'

type PreOrder = {
  id: string
  no_po: string
  nama_pemesan: string
  tipe_pemesan: string
  total: number
  sudah_dibayar: number
  status: string
  created_at: string
  modal_total: number
  keuntungan: number
}

type KasirTransaksi = {
  id: string
  tanggal: string
  produk: string
  qty: number
  total: number
  diskon: number
  metode: string
  dicatat_oleh: string
}

const PREORDER_STATUS: Record<string, string> = {
  menunggu_verifikasi: 'Menunggu',
  dp_diterima: 'DP Diterima',
  lunas: 'Lunas',
  ditolak: 'Ditolak',
  batal: 'Batal',
}

const JENIS_LABEL: Record<JenisLaporan, string> = {
  tenant: 'Tenant',
  merchandise: 'Merchandise',
  ticket: 'Ticket',
}

function downloadCsv(nama: string, header: string[], rows: Array<Array<string | number>>) {
  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${nama}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function StatCard({ label, value, color = 'text-slate-900' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/40">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold tracking-tight ${color}`}>{value}</p>
    </div>
  )
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export default function LaporanPage() {
  const [jenis, setJenis] = useState<JenisLaporan>('tenant')
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [preorders, setPreorders] = useState<PreOrder[]>([])
  const [kasir, setKasir] = useState<KasirTransaksi[]>([])
  const [tickets, setTickets] = useState<PesananTiket[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [tenantData, preorderData, kasirData, ticketData] = await Promise.all([
      getJSON<Tenant[]>('/api/tenants'),
      getJSON<PreOrder[]>('/api/merchandise/preorder').catch(() => []),
      getJSON<KasirTransaksi[]>('/api/merchandise/kasir?limit=1000').catch(() => []),
      getJSON<PesananTiket[]>('/api/ticket/penjualan').catch(() => []),
    ])
    setTenants(tenantData)
    setPreorders(preorderData)
    setKasir(kasirData)
    setTickets(ticketData)
  }, [])

  useEffect(() => {
    load().catch((e) => toast.error(e.message)).finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  const tenantAktif = useMemo(() => tenants.filter((t) => t.status !== 'batal'), [tenants])
  const preorderValid = useMemo(() => preorders.filter((p) => !['ditolak', 'batal'].includes(p.status)), [preorders])
  const ticketValid = useMemo(() => tickets.filter((t) => !['ditolak', 'batal'].includes(t.status)), [tickets])

  const tenantStats = useMemo(() => {
    const tagihan = tenantAktif.reduce((s, t) => s + t.harga_akhir, 0)
    const masuk = tenantAktif.reduce((s, t) => s + t.sudah_dibayar, 0)
    return { tagihan, masuk, piutang: tagihan - masuk }
  }, [tenantAktif])

  const merchStats = useMemo(() => {
    const poTotal = preorderValid.reduce((s, p) => s + Number(p.total), 0)
    const poMasuk = preorderValid.reduce((s, p) => s + Number(p.sudah_dibayar), 0)
    const labaPo = preorderValid.reduce((s, p) => s + Number(p.keuntungan), 0)
    const kasirTotal = kasir.reduce((s, k) => s + Number(k.total), 0)
    return { poTotal, poMasuk, labaPo, kasirTotal }
  }, [kasir, preorderValid])

  const ticketStats = useMemo(() => {
    const pendapatan = ticketValid.filter((t) => t.status === 'lunas').reduce((s, t) => s + t.total, 0)
    const tiketLunas = ticketValid.filter((t) => t.status === 'lunas').reduce((s, t) => s + t.jumlah, 0)
    const menunggu = ticketValid.filter((t) => t.status === 'menunggu_verifikasi').reduce((s, t) => s + t.total, 0)
    return { pendapatan, tiketLunas, menunggu, pesanan: ticketValid.length }
  }, [ticketValid])

  function exportCsv() {
    if (jenis === 'tenant') {
      downloadCsv(
        'laporan-tenant',
        ['Kode', 'Nama Usaha', 'Kategori', 'Jenis', 'Asal', 'Lokasi', 'Harga', 'DP', 'Dibayar', 'Sisa', 'Status', 'Tgl Daftar'],
        tenantAktif.map((t) => [
          t.kode_stand, t.nama_usaha, t.kategori_sewa?.nama ?? '', t.jenis_usaha, t.asal, t.lokasi,
          t.harga_akhir, t.dp_wajib, t.sudah_dibayar, t.harga_akhir - t.sudah_dibayar, STATUS_LABEL[t.status], t.tgl_daftar,
        ]),
      )
      return
    }

    if (jenis === 'merchandise') {
      downloadCsv(
        'laporan-merchandise',
        ['Sumber', 'Kode', 'Nama', 'Produk', 'Qty', 'Total', 'Dibayar', 'Status', 'Tanggal'],
        [
          ...preorderValid.map((p) => [
            'Preorder', p.no_po, p.nama_pemesan, '', '', p.total, p.sudah_dibayar, PREORDER_STATUS[p.status] ?? p.status, p.created_at,
          ]),
          ...kasir.map((k) => [
            'Kasir', k.id.slice(0, 8), k.dicatat_oleh, k.produk, k.qty, k.total, k.total, 'Lunas', k.tanggal,
          ]),
        ],
      )
      return
    }

    downloadCsv(
      'laporan-ticket',
      ['No Pesanan', 'Nama', 'Kontak', 'Tipe', 'Periode', 'Jumlah', 'Total', 'Status', 'Tanggal'],
      ticketValid.map((t) => [
        t.no_pesanan, t.nama_pembeli, t.kontak, t.tiket_nama ?? '', t.periode_nama ?? '', t.jumlah, t.total, t.status, t.created_at,
      ]),
    )
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Laporan</h1>
          <p className="mt-1 text-sm text-slate-500">Rekap detail tenant, merchandise, dan ticket.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={jenis}
            onChange={(e) => setJenis(e.target.value as JenisLaporan)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
          >
            <option value="tenant">Laporan Tenant</option>
            <option value="merchandise">Laporan Merchandise</option>
            <option value="ticket">Laporan Ticket</option>
          </select>
          <button onClick={exportCsv} className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700">
            Export CSV
          </button>
        </div>
      </div>

      {jenis === 'tenant' && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Tenant Aktif" value={String(tenantAktif.length)} color="text-primary-600" />
            <StatCard label="Total Tagihan" value={formatRupiah(tenantStats.tagihan)} />
            <StatCard label="Total Masuk" value={formatRupiah(tenantStats.masuk)} color="text-green-600" />
            <StatCard label="Piutang" value={formatRupiah(tenantStats.piutang)} color="text-orange-600" />
          </div>

          <TableShell>
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2.5">Kode</th><th className="px-3 py-2.5">Nama</th><th className="px-3 py-2.5">Kategori</th>
                <th className="px-3 py-2.5">Jenis</th><th className="px-3 py-2.5">Harga</th><th className="px-3 py-2.5">Dibayar</th>
                <th className="px-3 py-2.5">Sisa</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Tgl Daftar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {tenantAktif.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400">Belum ada data tenant.</td></tr>}
              {tenantAktif.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2.5 font-mono text-xs">{t.kode_stand}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-700">{t.nama_usaha}</td>
                  <td className="px-3 py-2.5">{t.kategori_sewa?.nama ?? '-'}</td>
                  <td className="px-3 py-2.5">{t.jenis_usaha}</td>
                  <td className="px-3 py-2.5">{formatRupiah(t.harga_akhir)}</td>
                  <td className="px-3 py-2.5 text-green-600">{formatRupiah(t.sudah_dibayar)}</td>
                  <td className="px-3 py-2.5 text-orange-600">{formatRupiah(t.harga_akhir - t.sudah_dibayar)}</td>
                  <td className="px-3 py-2.5">{STATUS_LABEL[t.status]}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{formatDate(t.tgl_daftar)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </>
      )}

      {jenis === 'merchandise' && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Nilai Preorder" value={formatRupiah(merchStats.poTotal)} />
            <StatCard label="Preorder Dibayar" value={formatRupiah(merchStats.poMasuk)} color="text-green-600" />
            <StatCard label="Penjualan Kasir" value={formatRupiah(merchStats.kasirTotal)} color="text-primary-600" />
            <StatCard label="Estimasi Laba Preorder" value={formatRupiah(merchStats.labaPo)} color="text-green-600" />
          </div>

          <section className="space-y-2">
            <h2 className="font-semibold text-slate-900">Preorder</h2>
            <TableShell>
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-2.5">No PO</th><th className="px-3 py-2.5">Nama</th><th className="px-3 py-2.5">Tipe</th>
                  <th className="px-3 py-2.5">Total</th><th className="px-3 py-2.5">Dibayar</th><th className="px-3 py-2.5">Laba</th>
                  <th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {preorderValid.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">Belum ada preorder.</td></tr>}
                {preorderValid.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 font-mono text-xs">{p.no_po}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-700">{p.nama_pemesan}</td>
                    <td className="px-3 py-2.5">{p.tipe_pemesan}</td>
                    <td className="px-3 py-2.5">{formatRupiah(p.total)}</td>
                    <td className="px-3 py-2.5 text-green-600">{formatRupiah(p.sudah_dibayar)}</td>
                    <td className="px-3 py-2.5 text-green-600">{formatRupiah(p.keuntungan)}</td>
                    <td className="px-3 py-2.5">{PREORDER_STATUS[p.status] ?? p.status}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-slate-900">Kasir Hari H</h2>
            <TableShell>
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-2.5">Tanggal</th><th className="px-3 py-2.5">Produk</th><th className="px-3 py-2.5">Qty</th>
                  <th className="px-3 py-2.5">Total</th><th className="px-3 py-2.5">Diskon</th><th className="px-3 py-2.5">Metode</th>
                  <th className="px-3 py-2.5">Dicatat Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {kasir.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Belum ada transaksi kasir.</td></tr>}
                {kasir.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 text-xs text-slate-500">{formatDate(k.tanggal)}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-700">{k.produk}</td>
                    <td className="px-3 py-2.5">{k.qty}</td>
                    <td className="px-3 py-2.5">{formatRupiah(k.total)}</td>
                    <td className="px-3 py-2.5">{formatRupiah(k.diskon)}</td>
                    <td className="px-3 py-2.5">{k.metode}</td>
                    <td className="px-3 py-2.5">{k.dicatat_oleh}</td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </section>
        </>
      )}

      {jenis === 'ticket' && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Pesanan Valid" value={String(ticketStats.pesanan)} />
            <StatCard label="Tiket Lunas" value={String(ticketStats.tiketLunas)} color="text-primary-600" />
            <StatCard label="Pendapatan Lunas" value={formatRupiah(ticketStats.pendapatan)} color="text-green-600" />
            <StatCard label="Menunggu Verifikasi" value={formatRupiah(ticketStats.menunggu)} color="text-orange-600" />
          </div>

          <TableShell>
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2.5">No Pesanan</th><th className="px-3 py-2.5">Nama</th><th className="px-3 py-2.5">Kontak</th>
                <th className="px-3 py-2.5">Tipe</th><th className="px-3 py-2.5">Periode</th><th className="px-3 py-2.5">Jumlah</th>
                <th className="px-3 py-2.5">Total</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {ticketValid.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400">Belum ada penjualan tiket.</td></tr>}
              {ticketValid.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2.5 font-mono text-xs">{t.no_pesanan}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-700">{t.nama_pembeli}</td>
                  <td className="px-3 py-2.5">{t.kontak}</td>
                  <td className="px-3 py-2.5">{t.tiket_nama ?? '-'}</td>
                  <td className="px-3 py-2.5">{t.periode_nama ?? '-'}</td>
                  <td className="px-3 py-2.5">{t.jumlah}</td>
                  <td className="px-3 py-2.5">{formatRupiah(t.total)}</td>
                  <td className="px-3 py-2.5">{t.status === 'lunas' ? 'Lunas' : t.status === 'menunggu_verifikasi' ? 'Menunggu' : t.status}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{formatDate(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </>
      )}

      <p className="text-xs text-slate-400">Menampilkan laporan {JENIS_LABEL[jenis]} dari data terbaru.</p>
    </div>
  )
}
