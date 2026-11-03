'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../../api'
import { PageSkeleton } from '../../../ui'
import { QrImage } from '@/components/qr-image'
import type { Merchandise } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import { hitungDiskon } from '@/lib/merch-diskon'
import { buatQrisDinamis } from '@/lib/qris'

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'

export default function KasirNewPage() {
  const router = useRouter()
  const [produk, setProduk] = useState<Merchandise[]>([])
  const [kasir, setKasir] = useState('')
  const [qrisPayload, setQrisPayload] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ merchandise_id: '', qty: 1, metode: 'Tunai' })

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )dashboard_user=([^;]+)/)
    if (match) {
      try {
        setKasir(JSON.parse(decodeURIComponent(match[1])).name ?? '')
      } catch {
        setKasir('')
      }
    }
    fetch('/api/pengaturan/qris')
      .then((res) => res.json())
      .then((data) => setQrisPayload(data.qris_payload || ''))
      .catch(() => setQrisPayload(''))
    getJSON<Merchandise[]>('/api/merchandise')
      .then((items) => {
        const produkHariH = items.filter((item) => item.aktif && Number(item.harga) > 0)
        setProduk(produkHariH)
        setForm((f) => ({ ...f, merchandise_id: produkHariH[0]?.id || '' }))
      })
      .catch(() => toast.error('Gagal memuat produk'))
      .finally(() => setLoading(false))
  }, [])

  const dipilih = useMemo(() => produk.find((item) => item.id === form.merchandise_id) ?? null, [produk, form.merchandise_id])
  const stokTersisa = dipilih && !dipilih.stok_unlimited ? Number(dipilih.stok) : null
  const stokHabis = stokTersisa !== null && stokTersisa < 1
  const hitung = useMemo(
    () => hitungDiskon(Number(form.qty), Number(dipilih?.harga ?? 0), dipilih?.diskon, 'hari_h'),
    [dipilih, form.qty],
  )
  const qrisValue = useMemo(
    () => (form.metode === 'QRIS' && qrisPayload && hitung.total > 0 ? buatQrisDinamis(qrisPayload, hitung.total) : ''),
    [form.metode, qrisPayload, hitung.total],
  )

  function ubahQty(value: number) {
    const max = stokTersisa === null ? 999 : Math.max(0, stokTersisa)
    const next = Math.max(1, Math.min(Number(value) || 1, max))
    setForm((f) => ({ ...f, qty: next }))
  }

  async function simpan(e: FormEvent) {
    e.preventDefault()
    if (!form.merchandise_id || !form.qty || form.qty < 1) {
      toast.error('Produk dan qty harus diisi')
      return
    }
    if (stokHabis) {
      toast.error('Stok produk ini sudah habis')
      return
    }
    if (stokTersisa !== null && form.qty > stokTersisa) {
      toast.error(`Stok tersisa ${stokTersisa}`)
      return
    }
    setSaving(true)
    try {
      await sendJSON('/api/merchandise/kasir', 'POST', {
        merchandise_id: form.merchandise_id,
        qty: form.qty,
        metode: form.metode,
      })
      toast.success('Transaksi disimpan')
      router.push('/dankelola/merchandise/kasir')
    } catch (err) {
      toast.error((err as Error).message)
      setSaving(false)
    }
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Transaksi Baru</h1>
        <p className="text-sm text-slate-500">
          Catat penjualan hari H. Kasir otomatis tercatat sebagai{' '}
          <span className="font-medium text-slate-700">{kasir || 'pengguna yang login'}</span>.
        </p>
      </div>

      {produk.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 text-center text-sm text-slate-500">
          Belum ada produk yang dijual pada hari H.
        </div>
      ) : (
        <form onSubmit={simpan} className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Produk</label>
            <select
              className={input}
              value={form.merchandise_id}
              onChange={(e) => setForm({ ...form, merchandise_id: e.target.value, qty: 1 })}
            >
              {produk.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nama} · {formatRupiah(Number(item.harga))}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Qty</label>
              <input
                type="number"
                min="1"
                max={stokTersisa ?? undefined}
                className={input}
                value={form.qty || ''}
                onChange={(e) => ubahQty(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Metode</label>
              <select className={input} value={form.metode} onChange={(e) => setForm({ ...form, metode: e.target.value })}>
                <option value="Tunai">Cash</option>
                <option value="QRIS">QRIS</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
            <span className={stokHabis ? 'font-medium text-red-600' : 'text-slate-500'}>
              {dipilih
                ? dipilih.stok_unlimited ? 'Stok tak terbatas' : stokHabis ? 'Stok habis' : `Stok tersisa ${stokTersisa}`
                : 'Pilih produk terlebih dahulu'}
            </span>
            <div className="text-right">
              {hitung.diskon > 0 && <p className="text-xs text-green-600">Diskon -{formatRupiah(hitung.diskon)}</p>}
              <span className="font-semibold text-slate-900">Total: {formatRupiah(hitung.total)}</span>
            </div>
          </div>

          {form.metode === 'QRIS' && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
              {qrisValue ? (
                <>
                  <QrImage value={qrisValue} size={200} />
                  <p className="text-sm text-slate-500">
                    Scan QRIS untuk membayar <span className="font-semibold text-slate-900">{formatRupiah(hitung.total)}</span>
                  </p>
                </>
              ) : (
                <p className="text-center text-sm text-slate-500">
                  {qrisPayload ? 'Nominal belum valid.' : 'QRIS belum diatur. Atur dulu di menu Pengaturan QRIS.'}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Link
              href="/dankelola/merchandise/kasir"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={saving || stokHabis}
              className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
