'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import type { Merchandise, MerchModalItem } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import { hitungDiskon } from '@/lib/merch-diskon'

type KasirTransaksi = {
  id: string
  merchandise_id: string | null
  tanggal: string
  produk: string
  qty: number
  total: number
  diskon: number
  metode: string
  dicatat_oleh: string
}

export default function KasirPage() {
  const [transaksi, setTransaksi] = useState<KasirTransaksi[]>([])
  const [produk, setProduk] = useState<Merchandise[]>([])
  const [modalSatuan, setModalSatuan] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ merchandise_id: '', qty: 1, metode: 'Tunai', dicatat_oleh: '' })

  const load = useCallback(async () => {
    const [data, daftarProduk, modalItems] = await Promise.all([
      getJSON<KasirTransaksi[]>('/api/merchandise/kasir'),
      getJSON<Merchandise[]>('/api/merchandise'),
      getJSON<MerchModalItem[]>('/api/merchandise/modal').catch(() => []),
    ])
    const produkHariH = daftarProduk.filter((item) => item.aktif && Number(item.harga) > 0)
    setTransaksi(data)
    setProduk(produkHariH)
    setModalSatuan((modalItems ?? []).reduce((sum, item) => sum + Number(item.harga), 0))
    setForm((f) => ({
      ...f,
      merchandise_id: produkHariH.some((item) => item.id === f.merchandise_id) ? f.merchandise_id : produkHariH[0]?.id || '',
    }))
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => {
        console.error('Failed to load kasir:', e)
        setError('Gagal memuat data kasir')
      })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  const dipilih = useMemo(() => produk.find((item) => item.id === form.merchandise_id) ?? null, [produk, form.merchandise_id])
  const hitung = useMemo(
    () => hitungDiskon(Number(form.qty), Number(dipilih?.harga ?? 0), dipilih?.diskon, 'hari_h'),
    [dipilih, form.qty],
  )
  const total = hitung.total

  async function tambah() {
    if (!form.merchandise_id || !form.dicatat_oleh || !form.qty || form.qty < 1) {
      toast.error('Produk, qty, dan nama kasir harus diisi')
      return
    }
    if (dipilih && !dipilih.stok_unlimited && form.qty > dipilih.stok) {
      toast.error(`Stok tersisa ${dipilih.stok}`)
      return
    }
    try {
      await sendJSON('/api/merchandise/kasir', 'POST', {
        merchandise_id: form.merchandise_id,
        qty: form.qty,
        metode: form.metode,
        dicatat_oleh: form.dicatat_oleh,
      })
      toast.success('Transaksi disimpan')
      setForm({ merchandise_id: form.merchandise_id, qty: 1, metode: 'Tunai', dicatat_oleh: form.dicatat_oleh })
      setShowForm(false)
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Penjualan Hari H</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  const totalHariIni = transaksi.reduce((s, t) => s + t.total, 0)
  const totalModal = transaksi.reduce((s, t) => s + (t.merchandise_id ? modalSatuan * t.qty : 0), 0)
  const keuntungan = totalHariIni - totalModal
  const tunai = transaksi.filter(t => t.metode === 'Tunai').reduce((s, t) => s + t.total, 0)
  const nonTunai = totalHariIni - tunai

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Penjualan Hari H</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium">+ Transaksi Baru</button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Transaksi</p>
          <p className="text-3xl font-bold text-primary-600">{transaksi.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Pendapatan</p>
          <p className="text-3xl font-bold text-green-600">{formatRupiah(totalHariIni)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Modal</p>
          <p className="text-3xl font-bold text-orange-600">{formatRupiah(totalModal)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Keuntungan</p>
          <p className={`text-3xl font-bold ${keuntungan >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatRupiah(keuntungan)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Metode</p>
          <p className="text-sm font-semibold text-slate-900">Tunai: {formatRupiah(tunai)}</p>
          <p className="text-sm font-semibold text-slate-900">Non-Tunai: {formatRupiah(nonTunai)}</p>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <h2 className="font-semibold mb-4">Transaksi Baru</h2>
          <div className="grid md:grid-cols-4 gap-3">
            <select className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.merchandise_id} onChange={e => setForm({ ...form, merchandise_id: e.target.value, qty: 1 })}>
              <option value="">Pilih produk</option>
              {produk.map((item) => (
                <option key={item.id} value={item.id}>{item.nama} · {formatRupiah(Number(item.harga))}</option>
              ))}
            </select>
            <input type="number" min="1" max={dipilih && !dipilih.stok_unlimited ? dipilih.stok : undefined} placeholder="Qty" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.qty || ''} onChange={e => setForm({ ...form, qty: Number(e.target.value) })} />
            <select className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.metode} onChange={e => setForm({ ...form, metode: e.target.value })}>
              <option>Tunai</option><option>QRIS</option><option>Transfer</option>
            </select>
            <input placeholder="Nama Kasir" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.dicatat_oleh} onChange={e => setForm({ ...form, dicatat_oleh: e.target.value })} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-slate-500">
              {dipilih
                ? dipilih.stok_unlimited ? 'Stok tak terbatas' : `Stok tersisa ${dipilih.stok}`
                : 'Pilih produk terlebih dahulu'}
            </span>
            <div className="text-right">
              {hitung.diskon > 0 && <p className="text-xs text-green-600">Diskon -{formatRupiah(hitung.diskon)}</p>}
              <span className="font-semibold text-slate-900">Total: {formatRupiah(total)}</span>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
            <button onClick={tambah} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-xl">Simpan</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Waktu</th>
              <th className="px-3 py-2">Produk</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2 text-right">Harga Jual</th>
              <th className="px-3 py-2 text-right">Modal</th>
              <th className="px-3 py-2 text-right">Keuntungan</th>
              <th className="px-3 py-2">Metode</th>
              <th className="px-3 py-2">Kasir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {transaksi.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">Belum ada transaksi hari ini.</td></tr>}
            {transaksi.map((t) => {
              const modal = t.merchandise_id ? modalSatuan * t.qty : 0
              const laba = t.total - modal
              return (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-500">{new Date(t.tanggal).toLocaleString('id-ID')}</td>
                  <td className="px-3 py-2 font-medium">{t.produk}</td>
                  <td className="px-3 py-2">{t.qty}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {formatRupiah(t.total)}
                    {t.diskon > 0 && <div className="text-[11px] text-green-600">Diskon -{formatRupiah(t.diskon)}</div>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-orange-600">{formatRupiah(modal)}</td>
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums ${laba >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatRupiah(laba)}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${t.metode === 'Tunai' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                      {t.metode}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{t.dicatat_oleh || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}