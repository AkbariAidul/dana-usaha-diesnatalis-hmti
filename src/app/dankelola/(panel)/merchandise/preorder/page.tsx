'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useConfirm } from '@/components/confirm-dialog'
import { BuktiPreviewModal, BuktiThumb } from '@/components/bukti'
import { Modal } from '@/components/modal'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import { formatDate, formatRupiah } from '@/lib/utils'

type Item = {
  id: string
  ukuran: string | null
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
  const [items, setItems] = useState<PreOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cicilanModal, setCicilanModal] = useState<string | null>(null)
  const [cicilanForm, setCicilanForm] = useState({ nominal: '', metode: 'QRIS' })
  const [preview, setPreview] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<PreOrder | null>(null)
  const [rejectReason, setRejectReason] = useState('')

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
  useLiveRefresh(load)

  async function updateStatus(id: string, status: string, catatan?: string) {
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

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Data Preorder</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  const menunggu = items.filter((i) => i.status === 'menunggu_verifikasi').length
  const dp = items.filter((i) => i.status === 'dp_diterima').length
  const lunas = items.filter((i) => i.status === 'lunas').length
  const diambil = items.filter((i) => i.picked_up_at).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Data Preorder</h1>
        <div className="flex gap-2">
          <Link href="/dankelola/merchandise/pengurus" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Data Pengurus</Link>
          <Link href="/dankelola/scan" className="rounded-xl bg-primary-600 px-3 py-2 text-sm font-medium text-white">Scan Pickup</Link>
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

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">No. PO</th>
              <th className="px-3 py-2">Pemesan</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Sudah Dibayar</th>
              <th className="px-3 py-2 text-right">Sisa</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Pembayaran</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {items.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">Belum ada pre-order.</td></tr>}
            {items.map((item) => {
              const sisa = Math.max(0, Number(item.total) - Number(item.sudah_dibayar ?? 0))
              return (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{item.no_po}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{item.nama_pemesan}</div>
                    <div className="text-xs text-slate-500">{item.tipe_pemesan} · {item.kontak}</div>
                    {item.pembayaran_metode && (
                      <div className="text-xs text-slate-400">{item.pembayaran_metode} · {item.pembayaran_tipe === 'nyicil' ? 'nyicil' : 'lunas'}</div>
                    )}
                    {item.pengurus && <div className="text-xs text-slate-400">{item.pengurus.divisi || '-'}</div>}
                  </td>
                  <td className="px-3 py-2">
                    {item.items?.map((i) => (
                      <div key={i.id} className="text-xs">
                        {i.merchandise?.nama ?? 'Item'}
                        {(i.varian?.nama || i.ukuran) ? ` (${i.varian?.nama || i.ukuran})` : ''} × {i.qty}
                      </div>
                    ))}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{formatRupiah(Number(item.total))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-green-600">{formatRupiah(Number(item.sudah_dibayar ?? 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-orange-600">{formatRupiah(sisa)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${
                      item.status === 'menunggu_verifikasi' ? 'bg-yellow-100 text-yellow-800' :
                      item.status === 'dp_diterima' ? 'bg-blue-100 text-blue-800' :
                      item.status === 'lunas' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {item.status.replace(/_/g, ' ')}
                    </span>
                    {item.picked_up_at && <div className="mt-1 text-xs text-green-700">Diambil {formatDate(item.picked_up_at)}</div>}
                  </td>
                  <td className="px-3 py-2">
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
                                  <button
                                    onClick={() => setPreview(c.bukti_url)}
                                    className="text-primary-600 hover:underline"
                                  >Bukti</button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
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
                      </div>
                    )}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {item.status === 'ditolak' ? (
                        <button onClick={() => updateStatus(item.id, 'menunggu_verifikasi')} className="rounded bg-slate-600 px-2 py-1 text-xs text-white">Buka Lagi</button>
                      ) : item.status === 'batal' || item.status === 'lunas' ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : item.pembayaran_tipe === 'nyicil' ? (
                        <button
                          onClick={() => setCicilanModal(cicilanModal === item.id ? null : item.id)}
                          className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
                        >Kelola Cicilan</button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleVerifikasi(item)}
                            className="rounded bg-green-600 px-2 py-1 text-xs text-white"
                            title="Verifikasi pembayaran yang diupload pemesan"
                          >
                            Verifikasi
                          </button>
                          <button onClick={() => openReject(item)} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Tolak</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <BuktiPreviewModal url={preview} onClose={() => setPreview(null)} />

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
    </div>
  )
}
