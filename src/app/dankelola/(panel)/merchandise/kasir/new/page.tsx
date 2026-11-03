'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../../api'
import { PageSkeleton } from '../../../ui'
import type { Merchandise } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import { hitungDiskon } from '@/lib/merch-diskon'

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'

export default function KasirNewPage() {
  const router = useRouter()
  const [produk, setProduk] = useState<Merchandise[]>([])
  const [kasir, setKasir] = useState('')
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
  const hitung = useMemo(
    () => hitungDiskon(Number(form.qty), Number(dipilih?.harga ?? 0), dipilih?.diskon, 'hari_h'),
    [dipilih, form.qty],
  )

  async function simpan(e: FormEvent) {
    e.preventDefault()
    if (!form.merchandise_id || !form.qty || form.qty < 1) {
      toast.error('Produk dan qty harus diisi')
      return
    }
    if (dipilih && !dipilih.stok_unlimited && form.qty > dipilih.stok) {
      toast.error(`Stok tersisa ${dipilih.stok}`)
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
                max={dipilih && !dipilih.stok_unlimited ? dipilih.stok : undefined}
                className={input}
                value={form.qty || ''}
                onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Metode</label>
              <select className={input} value={form.metode} onChange={(e) => setForm({ ...form, metode: e.target.value })}>
                <option>Tunai</option>
                <option>QRIS</option>
                <option>Transfer</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
            <span className="text-slate-500">
              {dipilih
                ? dipilih.stok_unlimited ? 'Stok tak terbatas' : `Stok tersisa ${dipilih.stok}`
                : 'Pilih produk terlebih dahulu'}
            </span>
            <div className="text-right">
              {hitung.diskon > 0 && <p className="text-xs text-green-600">Diskon -{formatRupiah(hitung.diskon)}</p>}
              <span className="font-semibold text-slate-900">Total: {formatRupiah(hitung.total)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Link
              href="/dankelola/merchandise/kasir"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={saving}
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
