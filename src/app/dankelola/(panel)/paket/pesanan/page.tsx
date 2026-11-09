'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, Download, Trash2, X } from 'lucide-react'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { useConfirm } from '@/components/confirm-dialog'
import { Modal } from '@/components/modal'
import { PageSkeleton } from '../../ui'
import { DataError } from '@/components/data-error'
import { useIsViewer } from '@/lib/dashboard-user'
import { BuktiPreviewModal, BuktiThumb } from '@/components/bukti'
import { QrImage } from '@/components/qr-image'
import { formatRupiah } from '@/lib/utils'
import type { BundleOrder, BundleOrderItem } from '@/lib/types'

type OrderRow = BundleOrder & { bundle_nama: string | null; qr_baju: string | null; qr_tiket: string | null; items: BundleOrderItem[] }
type QrPreview = { label: string; value: string; kode: string }

const STATUS_LABEL: Record<string, string> = {
  menunggu_verifikasi: 'Menunggu Verifikasi',
  lunas: 'Lunas',
  ditolak: 'Ditolak',
  batal: 'Batal',
}

function statusClass(status: string) {
  if (status === 'lunas') return 'bg-green-100 text-green-800'
  if (status === 'ditolak' || status === 'batal') return 'bg-red-100 text-red-800'
  return 'bg-yellow-100 text-yellow-800'
}

export default function PesananPaketPage() {
  const confirm = useConfirm()
  const isViewer = useIsViewer()
  const [items, setItems] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [qrPreview, setQrPreview] = useState<QrPreview | null>(null)
  const [strukTarget, setStrukTarget] = useState<OrderRow | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rejectTarget, setRejectTarget] = useState<OrderRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    const data = await getJSON<OrderRow[]>('/api/paket/pesanan')
    setItems(data)
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => { setError('Gagal memuat pesanan paket'); console.error(e) })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id))

  async function updateStatus(order: OrderRow, status: string, catatan?: string) {
    if (isViewer) return
    try {
      await sendJSON('/api/paket/pesanan', 'PATCH', { id: order.id, status, catatan_admin: catatan })
      toast.success(status === 'lunas' ? 'Pesanan paket diverifikasi' : `Status diubah ke ${STATUS_LABEL[status] ?? status}`)
      await load()
    } catch (e) {
      toast.error(String(e))
    }
  }

  async function verifikasi(order: OrderRow) {
    const ok = await confirm({
      title: 'Verifikasi paket?',
      description: `Pesanan ${order.no_pesanan} atas nama ${order.nama_pembeli} (${formatRupiah(Number(order.total))}) akan ditandai lunas. Tiket diterbitkan dan PO merchandise diproses otomatis.`,
      confirmText: 'Verifikasi',
      danger: false,
    })
    if (!ok) return
    await updateStatus(order, 'lunas')
  }

  async function batalkan(order: OrderRow) {
    const ok = await confirm({
      title: 'Batalkan pesanan paket?',
      description: `Pesanan ${order.no_pesanan} akan dibatalkan. Tiket yang sudah terbit dihapus dan kuota dikembalikan.`,
      confirmText: 'Batalkan',
      danger: true,
    })
    if (!ok) return
    await updateStatus(order, 'batal')
  }

  async function tolak() {
    if (!rejectTarget) return
    await updateStatus(rejectTarget, 'ditolak', rejectReason)
    setRejectTarget(null)
    setRejectReason('')
  }

  function toggleSelect(id: string) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))
  }

  async function hapusTerpilih() {
    if (selected.size === 0) return
    const ok = await confirm({ title: `Hapus ${selected.size} pesanan paket?`, description: 'Data tiket & PO turunannya juga dihapus permanen.', confirmText: 'Hapus' })
    if (!ok) return
    try {
      await sendJSON('/api/paket/pesanan', 'DELETE', { ids: [...selected] })
      toast.success(`${selected.size} pesanan paket dihapus`)
      setSelected(new Set())
      await load()
    } catch (e) { toast.error(String(e)) }
  }

  if (loading) return <PageSkeleton />
  if (error) return <div className="flex justify-center"><DataError title={error} /></div>

  const menunggu = items.filter((i) => i.status === 'menunggu_verifikasi').length
  const lunas = items.filter((i) => i.status === 'lunas').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pesanan Paket</h1>
          <p className="text-sm text-slate-500">Verifikasi pembayaran paket combo. {menunggu} menunggu, {lunas} lunas.</p>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{selected.size}</span> pesanan dipilih</p>
          <button type="button" onClick={hapusTerpilih} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">
            <Trash2 className="h-4 w-4" /> Hapus Terpilih
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-left border-b border-slate-200">
              <tr>
                {!isViewer && <th className="px-4 py-3 w-10"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Pilih semua" className="h-4 w-4 rounded border-slate-300 text-primary-600" /></th>}
                <th className="px-4 py-3 font-medium text-slate-600">No. Pesanan</th>
                <th className="px-4 py-3 font-medium text-slate-600">Pembeli</th>
                <th className="px-4 py-3 font-medium text-slate-600">Isi</th>
                <th className="px-4 py-3 font-medium text-slate-600">Total</th>
                <th className="px-4 py-3 font-medium text-slate-600">Bukti</th>
                <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 font-medium text-slate-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && (
                <tr><td colSpan={isViewer ? 7 : 8} className="px-4 py-12 text-center text-slate-400">Belum ada pesanan paket.</td></tr>
              )}
              {items.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors align-top">
                  {!isViewer && (
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(order.id)} onChange={() => toggleSelect(order.id)} aria-label={`Pilih ${order.no_pesanan}`} className="h-4 w-4 rounded border-slate-300 text-primary-600" />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{order.no_pesanan}</p>
                    <p className="text-xs text-slate-500">{order.bundle_nama ?? 'Paket'}</p>
                    {(order.qr_baju || order.qr_tiket) && (
                      <div className="mt-2 flex items-start gap-2">
                        {order.qr_baju && (
                          <button
                            type="button"
                            onClick={() => setQrPreview({ label: 'QR Pengambilan Baju', value: order.qr_baju!, kode: order.no_pesanan })}
                            className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 p-1 transition hover:border-primary-300 hover:bg-primary-50/40"
                            title="QR pengambilan merchandise"
                          >
                            <QrImage value={order.qr_baju} size={40} />
                            <span className="text-[10px] font-medium text-slate-500">Baju</span>
                          </button>
                        )}
                        {order.qr_tiket && (
                          <button
                            type="button"
                            onClick={() => setQrPreview({ label: 'QR Regist Tiket', value: order.qr_tiket!, kode: order.no_pesanan })}
                            className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 p-1 transition hover:border-primary-300 hover:bg-primary-50/40"
                            title="QR registrasi tiket"
                          >
                            <QrImage value={order.qr_tiket} size={40} />
                            <span className="text-[10px] font-medium text-slate-500">Tiket</span>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{order.nama_pembeli}</p>
                    <p className="text-xs text-slate-500">{order.kontak}</p>
                  </td>
                  <td className="px-4 py-3">
                    <ul className="space-y-0.5 text-xs text-slate-600">
                      {(order.items ?? []).map((i) => (
                        <li key={i.id}>
                          {i.qty}× {i.nama_snapshot}
                          {i.ukuran ? ` · ${i.ukuran}` : ''}{i.warna ? ` · ${i.warna}` : ''}{i.lengan ? ` · ${i.lengan}` : ''}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 font-bold text-primary-600">{formatRupiah(Number(order.total))}</td>
                  <td className="px-4 py-3">
                    {order.bukti_url ? (
                      <BuktiThumb url={order.bukti_url} label={`Bukti ${order.no_pesanan}`} onPreview={() => setPreview(order.bukti_url)} />
                    ) : <span className="text-xs text-slate-400">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${statusClass(order.status)}`}>
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {!isViewer && order.status === 'menunggu_verifikasi' && (
                      <div className="flex flex-wrap gap-1">
                        <button type="button" onClick={() => verifikasi(order)} className="inline-flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700">
                          <Check className="h-3 w-3" /> Verifikasi
                        </button>
                        <button type="button" onClick={() => { setRejectTarget(order); setRejectReason('') }} className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">
                          <X className="h-3 w-3" /> Tolak
                        </button>
                      </div>
                    )}
                    {!isViewer && order.status === 'lunas' && (
                      <button type="button" onClick={() => batalkan(order)} className="rounded bg-slate-600 px-2 py-1 text-xs text-white hover:bg-slate-700">Batalkan</button>
                    )}
                    {!isViewer && (order.status === 'ditolak' || order.status === 'batal') && (
                      <button type="button" onClick={() => updateStatus(order, 'menunggu_verifikasi')} className="rounded bg-slate-600 px-2 py-1 text-xs text-white hover:bg-slate-700">Buka Lagi</button>
                    )}
                    {order.status === 'lunas' && (
                      <button
                        type="button"
                        onClick={() => setStrukTarget(order)}
                        title={`Lihat struk ${order.no_pesanan}`}
                        className="mt-1 inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100"
                      >
                        <Download className="h-3 w-3" /> Struk
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <BuktiPreviewModal url={preview} onClose={() => setPreview(null)} />

      <Modal open={!!qrPreview} onClose={() => setQrPreview(null)}>
        {qrPreview && (
          <div className="text-center">
            <h2 className="text-lg font-semibold text-slate-900">{qrPreview.label}</h2>
            <p className="text-sm text-slate-500">{qrPreview.kode}</p>
            <div className="mx-auto mt-4 w-fit rounded-2xl border border-slate-200 bg-white p-3">
              <QrImage value={qrPreview.value} size={240} />
            </div>
            <p className="mt-3 text-xs text-slate-400">Scan lewat menu Scan QR untuk konfirmasi.</p>
          </div>
        )}
      </Modal>

      <Modal open={!!strukTarget} onClose={() => setStrukTarget(null)} panelClassName="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        {strukTarget && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Struk {strukTarget.no_pesanan}</h2>
                <p className="text-sm text-slate-500">{strukTarget.nama_pembeli} · {strukTarget.kontak}</p>
              </div>
              <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">Lunas</span>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Varian</th>
                    <th className="px-3 py-2 text-center">Qty</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(strukTarget.items ?? []).map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2">{it.nama_snapshot}</td>
                      <td className="px-3 py-2">{[it.warna, it.lengan, it.ukuran].filter(Boolean).join(' · ') || '-'}</td>
                      <td className="px-3 py-2 text-center">{it.qty}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(Number(it.subtotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex justify-between rounded-xl bg-slate-50 p-3 text-sm">
              <span className="text-slate-500">Total Paket</span>
              <span className="font-semibold">{formatRupiah(Number(strukTarget.total))}</span>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setStrukTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Tutup</button>
              <a href={`/api/paket/struk?kode=${encodeURIComponent(strukTarget.no_pesanan)}`} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">Download PDF</a>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)}>
        <h2 className="mb-1 text-lg font-semibold text-slate-900">Tolak Pesanan</h2>
        <p className="mb-3 text-sm text-slate-500">{rejectTarget?.no_pesanan} · {rejectTarget?.nama_pembeli}</p>
        <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="Alasan penolakan (opsional)" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setRejectTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Batal</button>
          <button type="button" onClick={tolak} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Tolak</button>
        </div>
      </Modal>
    </div>
  )
}
