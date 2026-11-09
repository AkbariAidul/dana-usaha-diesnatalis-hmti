'use client'

import { DataError } from '@/components/data-error'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useConfirm } from '@/components/confirm-dialog'
import { BuktiPreviewModal, BuktiThumb } from '@/components/bukti'
import { Modal } from '@/components/modal'
import { QrImage } from '@/components/qr-image'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { useIsViewer } from '@/lib/dashboard-user'
import { PageSkeleton } from '../../ui'
import { formatDate, formatDateTime, formatRupiah } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  menunggu_verifikasi: 'Menunggu Verifikasi',
  dp_diterima: 'DP Diterima',
  lunas: 'Lunas',
  ditolak: 'Ditolak',
  batal: 'Batal',
}

function statusClass(status: string) {
  if (status === 'lunas') return 'bg-green-100 text-green-800'
  if (status === 'ditolak' || status === 'batal') return 'bg-red-100 text-red-800'
  if (status === 'dp_diterima') return 'bg-blue-100 text-blue-800'
  return 'bg-yellow-100 text-yellow-800'
}

type Item = {
  id: string
  ukuran: string | null
  warna: string | null
  lengan: string | null
  qty: number
  subtotal: number
  merchandise: { nama: string } | null
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
}

type PreOrder = {
  id: string
  no_po: string
  qr: string
  nama_pemesan: string
  kontak: string
  tipe_pemesan: string
  total: number
  sudah_dibayar: number
  pembayaran_metode: string | null
  pembayaran_tipe: string | null
  status: string
  bukti_url: string | null
  catatan_admin: string | null
  picked_up_at: string | null
  picked_up_by: string | null
  created_at: string
  modal_satuan: number
  modal_total: number
  keuntungan: number
  pengurus: { nama: string; divisi: string | null } | null
  items: Item[]
  cicilan?: Cicilan[]
}

export default function PreorderPage() {
  const confirm = useConfirm()
  const isViewer = useIsViewer()
  const [items, setItems] = useState<PreOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cicilanModal, setCicilanModal] = useState<string | null>(null)
  const [cicilanForm, setCicilanForm] = useState({ nominal: '', metode: 'QRIS' })
  const [preview, setPreview] = useState<string | null>(null)
  const [qrPreview, setQrPreview] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<PreOrder | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [strukTarget, setStrukTarget] = useState<PreOrder | null>(null)
  const [filterTipe, setFilterTipe] = useState('all')
  const [filterAmbil, setFilterAmbil] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedPO, setSelectedPO] = useState<Set<string>>(new Set())

  async function load() {
    try {
      const list = await getJSON<PreOrder[]>('/api/merchandise/preorder')
      // Fetch cicilan untuk setiap PO
      const withCicilan = await Promise.all(
        list.map(async (po) => {
          try {
            const res = await fetch(`/api/merchandise/preorder/cicilan?po_id=${po.id}`)
            const cicilan = await res.json()
            return { ...po, cicilan: Array.isArray(cicilan) ? cicilan : [] }
          } catch {
            return { ...po, cicilan: [] }
          }
        })
      )
      setItems(withCicilan)
      setError(null)
    } catch (e) {
      setError('Gagal memuat data pre-order')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [search, filterTipe, filterAmbil])
  useLiveRefresh(load)

  async function updateStatus(id: string, status: string, catatan?: string) {
    if (isViewer) return false
    try {
      await sendJSON('/api/merchandise/preorder', 'PATCH', { id, status, catatan_admin: catatan })
      toast.success(status === 'ditolak' ? 'Pesanan ditolak' : `Status diubah ke ${status.replace(/_/g, ' ')}`)
      await load()
      return true
    } catch (e) {
      toast.error((e as Error).message)
      return false
    }
  }

  async function tambahCicilan(poId: string) {
    if (isViewer) return
    const nominal = Number(cicilanForm.nominal)
    if (!nominal || nominal <= 0) {
      toast.error('Nominal harus lebih dari 0')
      return
    }
    try {
      await sendJSON('/api/merchandise/preorder/cicilan', 'POST', {
        po_id: poId,
        nominal,
        metode: cicilanForm.metode,
      })
      toast.success('Pembayaran berhasil ditambahkan')
      setCicilanModal(null)
      setCicilanForm({ nominal: '', metode: 'QRIS' })
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function toggleValidasi(id: string, validated: boolean) {
    if (isViewer) return
    try {
      await sendJSON('/api/merchandise/preorder/cicilan', 'PATCH', { id, validated })
      toast.success(validated ? 'Pembayaran diverifikasi' : 'Verifikasi dibatalkan')
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function handleVerifikasi(po: PreOrder, target?: Cicilan) {
    const pending = target ?? po.cicilan?.find((c) => !c.validated)
    if (!pending) {
      toast.error('Tidak ada pembayaran yang menunggu verifikasi. Tambahkan pembayaran manual bila bayar tunai.')
      return
    }
    const ok = await confirm({
      title: 'Verifikasi pembayaran?',
      description: `Pembayaran ${formatRupiah(Number(pending.nominal))} untuk PO ${po.no_po} atas nama ${po.nama_pemesan} akan diverifikasi.`,
      confirmText: 'Verifikasi',
      danger: false,
    })
    if (!ok) return
    await toggleValidasi(pending.id, true)
  }

  function openReject(po: PreOrder) {
    setRejectReason('')
    setRejectTarget(po)
  }

  async function submitReject() {
    if (!rejectTarget) return
    const reason = rejectReason.trim()
    if (!reason) {
      toast.error('Alasan penolakan wajib diisi')
      return
    }
    const ok = await updateStatus(rejectTarget.id, 'ditolak', reason)
    if (ok) {
      setRejectTarget(null)
      setRejectReason('')
    }
  }

  function toggleSelectPO(id: string) { setSelectedPO((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n }) }
  function toggleSelectAllPO() {
    const isAll = filtered.length > 0 && filtered.every((item) => selectedPO.has(item.id))
    setSelectedPO(isAll ? new Set() : new Set(filtered.map((i) => i.id)))
  }
  async function hapusTerpilih() {
    const chosen = items.filter((i) => selectedPO.has(i.id))
    if (chosen.length === 0) return
    const ok = await confirm({ title: `Hapus ${chosen.length} PO terpilih?`, description: 'Data akan dihapus permanen dari database.', confirmText: 'Hapus' })
    if (!ok) return
    try {
      await sendJSON('/api/merchandise/preorder', 'DELETE', { ids: [...selectedPO] })
      toast.success(`${chosen.length} PO dihapus`)
      setSelectedPO(new Set())
      await load()
    } catch (e) { toast.error(String(e)) }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="flex justify-center">
      <DataError title={error} />
    </div>
  )

  const menunggu = items.filter((i) => i.status === 'menunggu_verifikasi').length
  const dp = items.filter((i) => i.status === 'dp_diterima').length
  const lunas = items.filter((i) => i.status === 'lunas').length
  const diambil = items.filter((i) => i.picked_up_at).length
  const totalUmum = items.filter((i) => i.tipe_pemesan === 'Umum').length
  const totalPengurus = items.filter((i) => i.tipe_pemesan === 'Pengurus Himpunan').length
  const totalBelum = items.filter((i) => !i.picked_up_at).length
  const totalDiambil = items.filter((i) => i.picked_up_at).length
  const keyword = search.trim().toLowerCase()
  const filtered = items.filter((i) => {
    if (filterTipe !== 'all' && i.tipe_pemesan !== filterTipe) return false
    if (filterAmbil === 'belum' && i.picked_up_at) return false
    if (filterAmbil === 'sudah' && !i.picked_up_at) return false
    if (!keyword) return true
    return [i.no_po, i.nama_pemesan, i.kontak, ...i.items.map((it) => it.merchandise?.nama ?? '')]
      .some((v) => v.toLowerCase().includes(keyword))
  })
  const PER_PAGE = 10
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Data Preorder</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterAmbil}
            onChange={(e) => setFilterAmbil(e.target.value)}
            aria-label="Filter pengambilan"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-400 focus:outline-none"
          >
            <option value="all">Semua Pengambilan ({items.length})</option>
            <option value="belum">Belum Diambil ({totalBelum})</option>
            <option value="sudah">Sudah Diambil ({totalDiambil})</option>
          </select>
          <select
            value={filterTipe}
            onChange={(e) => setFilterTipe(e.target.value)}
            aria-label="Filter tipe pemesan"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-400 focus:outline-none"
          >
            <option value="all">Semua ({items.length})</option>
            <option value="Umum">Umum ({totalUmum})</option>
            <option value="Pengurus Himpunan">Pengurus Himpunan ({totalPengurus})</option>
          </select>
          <div className="relative w-full min-w-[12rem] sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari no. PO, nama, kontak..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 focus:border-primary-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Menunggu</p>
          <p className="text-3xl font-bold text-yellow-600">{menunggu}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">DP Diterima</p>
          <p className="text-3xl font-bold text-blue-600">{dp}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Lunas</p>
          <p className="text-3xl font-bold text-green-600">{lunas}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Sudah Diambil</p>
          <p className="text-3xl font-bold text-violet-600">{diambil}</p>
        </div>
      </div>

      {selectedPO.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{selectedPO.size}</span> PO dipilih</p>
          <button type="button" onClick={hapusTerpilih} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700">
            <Trash2 className="h-4 w-4" /> Hapus Terpilih
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              {!isViewer && <th className="px-3 py-2 w-8"><input type="checkbox" checked={filtered.length > 0 && filtered.every((item) => selectedPO.has(item.id))} onChange={toggleSelectAllPO} aria-label="Pilih semua" className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" /></th>}
              <th className="px-3 py-2">No. PO / QR Pengambilan</th>
              <th className="px-3 py-2">Pemesan</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Sudah Dibayar</th>
              <th className="px-3 py-2 text-right">Sisa</th>
              <th className="px-3 py-2">Pengambilan</th>
              <th className="px-3 py-2">Pembayaran</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {filtered.length === 0 && (
              <tr><td colSpan={isViewer ? 9 : 10} className="px-3 py-6 text-center text-slate-400">
                {items.length === 0 ? 'Belum ada pre-order.' : 'Tidak ada PO yang cocok.'}
              </td></tr>
            )}
            {paginated.map((item) => {
              const sisa = Math.max(0, Number(item.total) - Number(item.sudah_dibayar ?? 0))
              return (
                <tr key={item.id} className="hover:bg-slate-50">
                  {!isViewer && (
                    <td className="px-3 py-2 align-top"><input type="checkbox" checked={selectedPO.has(item.id)} onChange={() => toggleSelectPO(item.id)} aria-label={`Pilih ${item.no_po}`} className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" /></td>
                  )}
                  <td className="px-3 py-2 align-top">
                    <div className="font-mono text-xs">{item.no_po}</div>
                    <button
                      type="button"
                      onClick={() => setQrPreview(item.qr)}
                      className="mt-1 block rounded-md border border-slate-200 bg-white p-0.5 transition hover:ring-2 hover:ring-primary-200"
                      title="Perbesar QR pengambilan"
                    >
                      <QrImage value={item.qr} size={64} />
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{item.nama_pemesan}</div>
                    <div className="text-xs text-slate-500">{item.tipe_pemesan} · {item.kontak}</div>
                    {item.tipe_pemesan === 'Pengurus Himpunan' && item.pembayaran_metode && (
                      <div className="text-xs text-slate-400">{item.pembayaran_metode} · {item.pembayaran_tipe === 'nyicil' ? 'nyicil' : 'lunas'}</div>
                    )}
                    {item.pengurus && <div className="text-xs text-slate-400">{item.pengurus.divisi || '-'}</div>}
                  </td>
                  <td className="px-3 py-2">
                    {item.items?.map((i) => (
                      <div key={i.id} className="text-xs">
                        {i.merchandise?.nama ?? 'Item'}
                        {(() => {
                          const varian = [i.warna, i.lengan, i.varian?.nama || i.ukuran].filter(Boolean).join(' · ')
                          return varian ? ` (${varian})` : ''
                        })()} × {i.qty}
                      </div>
                    ))}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{formatRupiah(Number(item.total))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-green-600">{formatRupiah(Number(item.sudah_dibayar ?? 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-orange-600">{formatRupiah(sisa)}</td>
                  <td className="px-3 py-2">
                    {item.picked_up_at ? (
                      <div>
                        <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">Sudah Diambil</span>
                        <div className="mt-1 whitespace-nowrap text-xs text-slate-500">{formatDateTime(item.picked_up_at)}</div>
                        {item.picked_up_by && <div className="text-xs text-slate-500">oleh {item.picked_up_by}</div>}
                      </div>
                    ) : (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Belum Diambil</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${statusClass(item.status)}`}>
                      {STATUS_LABEL[item.status] ?? item.status.replace(/_/g, ' ')}
                    </span>
                    <div className="mt-2">
                    {item.pembayaran_tipe !== 'nyicil' ? (
                      item.bukti_url ? (
                        <BuktiThumb url={item.bukti_url} label={`Bukti ${item.no_po}`} onPreview={() => setPreview(item.bukti_url)} />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )
                    ) : (
                      <>
                    <button
                      onClick={() => setCicilanModal(cicilanModal === item.id ? null : item.id)}
                      className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
                    >
                      {item.cicilan?.length ?? 0} cicilan
                    </button>
                    {cicilanModal === item.id && (
                      <div className="mt-2 space-y-2">
                        {item.cicilan?.map((c) => (
                          <div key={c.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                            <div className="flex justify-between">
                              <span className="font-mono">{c.no_transaksi}</span>
                              <span className="font-medium">{formatRupiah(c.nominal)}</span>
                            </div>
                            <div className="text-slate-500">{formatDate(c.tanggal_bayar)} · {c.metode}</div>
                            <div className="mt-1 flex items-center justify-between">
                              <span className={`rounded px-1.5 py-0.5 ${c.validated ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {c.validated ? 'Terverifikasi' : 'Pending'}
                              </span>
                              <div className="flex gap-1">
                                {!c.validated && (
                                  <>
                                    <button
                                      onClick={() => handleVerifikasi(item, c)}
                                      className="rounded bg-green-600 px-1.5 py-0.5 text-xs text-white"
                                    >Verifikasi</button>
                                    <button
                                      onClick={() => openReject(item)}
                                      className="rounded bg-red-600 px-1.5 py-0.5 text-xs text-white"
                                    >Tolak</button>
                                  </>
                                )}
                                {c.bukti_url && (
                                  <BuktiThumb
                                    url={c.bukti_url}
                                    label={`Bukti ${c.no_transaksi}`}
                                    onPreview={() => setPreview(c.bukti_url)}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {item.status === 'lunas' || sisa <= 0 ? (
                          <p className="rounded-lg bg-green-50 px-2 py-1.5 text-xs text-green-700">
                            Pembayaran sudah lunas.
                          </p>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="Nominal"
                              value={cicilanForm.nominal}
                              onChange={(e) => setCicilanForm({ ...cicilanForm, nominal: e.target.value })}
                              className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                            />
                            <select
                              value={cicilanForm.metode}
                              onChange={(e) => setCicilanForm({ ...cicilanForm, metode: e.target.value })}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                            >
                              <option>QRIS</option>
                              <option>Cash</option>
                            </select>
                            <button
                              onClick={() => tambahCicilan(item.id)}
                              className="rounded bg-violet-600 px-2 py-1 text-xs text-white"
                            >Tambah</button>
                          </div>
                        )}
                      </div>
                    )}
                      </>
                    )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {item.status === 'ditolak' ? (
                        <>
                          <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">Ditolak</span>
                          <span className={isViewer ? 'pointer-events-none select-none opacity-40 blur-[1px]' : undefined}>
                            <button onClick={() => updateStatus(item.id, 'menunggu_verifikasi')} className="rounded bg-slate-600 px-2 py-1 text-xs text-white">Buka Lagi</button>
                          </span>
                        </>
                      ) : item.status === 'lunas' ? (
                        <>
                          <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">Lunas</span>
                          <span className={isViewer ? 'pointer-events-none select-none opacity-40 blur-[1px]' : undefined}>
                            <button
                              onClick={() => setStrukTarget(item)}
                              className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
                            >
                              Struk
                            </button>
                          </span>
                        </>
                      ) : item.status === 'batal' ? (
                        <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">Batal</span>
                      ) : (
                        <span className={isViewer ? 'pointer-events-none select-none opacity-40 blur-[1px] flex flex-wrap gap-1' : 'flex flex-wrap gap-1'}>
                          {item.cicilan?.some((c) => !c.validated) && (
                            <button
                              onClick={() => handleVerifikasi(item)}
                              className="rounded bg-green-600 px-2 py-1 text-xs text-white"
                              title="Verifikasi pembayaran yang diupload pemesan"
                            >
                              Verifikasi
                            </button>
                          )}
                          {item.pembayaran_tipe === 'nyicil' && (
                            <button
                              onClick={() => setCicilanModal(cicilanModal === item.id ? null : item.id)}
                              className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
                            >Kelola Cicilan</button>
                          )}
                          <button onClick={() => openReject(item)} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Tolak</button>
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Menampilkan {filtered.length === 0 ? 0 : (currentPage - 1) * PER_PAGE + 1}–{Math.min(currentPage * PER_PAGE, filtered.length)} dari {filtered.length} pesanan
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

      <BuktiPreviewModal url={preview} onClose={() => setPreview(null)} />

      <Modal
        open={!!qrPreview}
        onClose={() => setQrPreview(null)}
        panelClassName="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-xl"
      >
        <p className="text-sm font-semibold text-slate-900">QR Pengambilan</p>
        <div className="mx-auto mt-3 w-fit rounded-xl border border-slate-200 p-3">
          {qrPreview && <QrImage value={qrPreview} size={256} />}
        </div>
        <p className="mt-2 break-all font-mono text-[10px] text-slate-400">{qrPreview}</p>
        <button
          type="button"
          onClick={() => setQrPreview(null)}
          className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Tutup
        </button>
      </Modal>

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)}>
        <h2 className="text-lg font-semibold text-slate-900">Tolak pesanan?</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pesanan {rejectTarget?.no_po} atas nama {rejectTarget?.nama_pemesan} akan ditolak.
        </p>
        <label className="mb-1 mt-4 block text-xs font-medium text-slate-500">Alasan penolakan</label>
        <textarea
          rows={3}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Contoh: Bukti transfer tidak valid"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setRejectTarget(null)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void submitReject()}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
          >
            Tolak Pesanan
          </button>
        </div>
      </Modal>

      <Modal open={!!strukTarget} onClose={() => setStrukTarget(null)} panelClassName="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        {strukTarget && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Struk {strukTarget.no_po}</h2>
                <p className="text-sm text-slate-500">{strukTarget.nama_pemesan} · {strukTarget.tipe_pemesan}</p>
              </div>
              <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">Lunas</span>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Produk</th>
                    <th className="px-3 py-2">Varian</th>
                    <th className="px-3 py-2 text-center">Qty</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {strukTarget.items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2">{it.merchandise?.nama ?? 'Merchandise'}</td>
                      <td className="px-3 py-2">
                        {[it.warna, it.lengan, it.varian?.nama || it.ukuran].filter(Boolean).join(' · ') || '-'}
                      </td>
                      <td className="px-3 py-2 text-center">{it.qty}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(Number(it.subtotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-semibold">{formatRupiah(Number(strukTarget.total))}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Sudah Dibayar</span><span className="font-medium text-green-700">{formatRupiah(Number(strukTarget.sudah_dibayar ?? 0))}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Sisa</span><span className="font-medium text-orange-600">{formatRupiah(Math.max(0, Number(strukTarget.total) - Number(strukTarget.sudah_dibayar ?? 0)))}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tanggal PO</span><span>{formatDate(strukTarget.created_at)}</span></div>
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
                href={`/api/merchandise/preorder/struk?id=${strukTarget.id}`}
                className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Download PDF
              </a>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
