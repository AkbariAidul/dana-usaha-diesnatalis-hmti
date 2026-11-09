'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Camera, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../../api'
import { PageSkeleton } from '../../../ui'
import { QrImage } from '@/components/qr-image'
import type { Merchandise } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import { hitungDiskon } from '@/lib/merch-diskon'
import { hargaMulai, hargaUntuk, opsiLengan, opsiWarna, type Lengan } from '@/lib/merch-harga'
import { buatQrisDinamis } from '@/lib/qris'
import { useDashboardUser } from '@/lib/dashboard-user'

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'

export default function KasirNewPage() {
  const router = useRouter()
  const currentUser = useDashboardUser()
  const [produk, setProduk] = useState<Merchandise[]>([])
  const [kasir, setKasir] = useState('')
  const [qrisPayload, setQrisPayload] = useState('')
  const [buktiUrl, setBuktiUrl] = useState('')
  const [uploadingBukti, setUploadingBukti] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{ merchandise_id: string; qty: number; metode: string; warna: string; lengan: Lengan | '' }>({
    merchandise_id: '',
    qty: 1,
    metode: 'Tunai',
    warna: '',
    lengan: '',
  })

  useEffect(() => {
    if (currentUser?.name) setKasir(currentUser.name)
  }, [currentUser])

  useEffect(() => {
    fetch('/api/pengaturan/qris')
      .then((res) => res.json())
      .then((data) => setQrisPayload(data.qris_payload || ''))
      .catch(() => setQrisPayload(''))
    getJSON<Merchandise[]>('/api/merchandise')
      .then((items) => {
        const produkHariH = items.filter((item) => item.aktif && opsiLengan(item, 'hari_h').length > 0)
        setProduk(produkHariH)
        const first = produkHariH[0]
        setForm((f) => ({
          ...f,
          merchandise_id: first?.id || '',
          warna: opsiWarna(first?.warna)[0] ?? '',
          lengan: first ? opsiLengan(first, 'hari_h')[0] ?? '' : '',
        }))
      })
      .catch(() => toast.error('Gagal memuat produk'))
      .finally(() => setLoading(false))
  }, [])

  const dipilih = useMemo(() => produk.find((item) => item.id === form.merchandise_id) ?? null, [produk, form.merchandise_id])
  const stokTersisa = dipilih && !dipilih.stok_unlimited ? Number(dipilih.stok) : null
  const stokHabis = stokTersisa !== null && stokTersisa < 1
  const warnaOpsi = useMemo(() => opsiWarna(dipilih?.warna), [dipilih])
  const lenganOpsi = useMemo(() => (dipilih ? opsiLengan(dipilih, 'hari_h') : []), [dipilih])
  const hargaSatuan = dipilih ? hargaUntuk(dipilih, 'Umum', (form.lengan || 'Pendek') as Lengan, 'hari_h') : 0
  const hitung = useMemo(
    () => hitungDiskon(Number(form.qty), hargaSatuan, dipilih?.diskon, 'hari_h'),
    [dipilih, form.qty, hargaSatuan],
  )
  const qrisValue = useMemo(
    () => (form.metode === 'QRIS' && qrisPayload && hitung.total > 0 ? buatQrisDinamis(qrisPayload, hitung.total) : ''),
    [form.metode, qrisPayload, hitung.total],
  )

  function ubahQty(raw: string) {
    if (raw === '') {
      setForm((f) => ({ ...f, qty: 0 }))
      return
    }
    const max = stokTersisa === null ? 999 : Math.max(1, stokTersisa)
    setForm((f) => ({ ...f, qty: Math.min(Math.max(1, Number(raw) || 1), max) }))
  }

  function rapikanQty() {
    if (form.qty < 1) setForm((f) => ({ ...f, qty: 1 }))
  }

  async function pilihBukti(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingBukti(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'kasir-bukti')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal upload bukti')
      setBuktiUrl(data.url)
      toast.success('Bukti pembayaran diunggah')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setUploadingBukti(false)
    }
  }

  async function simpan(e: FormEvent) {
    e.preventDefault()
    if (!form.merchandise_id || !form.qty || form.qty < 1) {
      toast.error('Produk dan qty harus diisi')
      return
    }
    if (warnaOpsi.length > 0 && !form.warna) {
      toast.error('Pilih warna produk')
      return
    }
    if (lenganOpsi.length > 0 && !form.lengan) {
      toast.error('Pilih lengan produk')
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
        warna: form.warna || null,
        lengan: form.lengan || null,
        bukti_url: form.metode === 'QRIS' ? buktiUrl || null : null,
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
              onChange={(e) => {
                const next = produk.find((item) => item.id === e.target.value)
                setForm({
                  ...form,
                  merchandise_id: e.target.value,
                  qty: 1,
                  warna: next ? opsiWarna(next.warna)[0] ?? '' : '',
                  lengan: next ? opsiLengan(next, 'hari_h')[0] ?? '' : '',
                })
              }}
            >
              {produk.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nama} · {formatRupiah(hargaMulai(item, 'Umum', 'hari_h'))}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {warnaOpsi.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Warna</label>
                <select className={input} value={form.warna} onChange={(e) => setForm({ ...form, warna: e.target.value })}>
                  <option value="">Pilih warna</option>
                  {warnaOpsi.map((warna) => (
                    <option key={warna} value={warna}>{warna}</option>
                  ))}
                </select>
              </div>
            )}
            {lenganOpsi.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Lengan</label>
                <select className={input} value={form.lengan} onChange={(e) => setForm({ ...form, lengan: e.target.value as Lengan })}>
                  <option value="">Pilih lengan</option>
                  {lenganOpsi.map((lengan) => (
                    <option key={lengan} value={lengan}>{lengan}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Qty</label>
              <input
                type="number"
                min="1"
                max={stokTersisa ?? undefined}
                className={input}
                value={form.qty || ''}
                onChange={(e) => ubahQty(e.target.value)}
                onBlur={rapikanQty}
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

              <div className="w-full border-t border-slate-100 pt-3">
                <p className="mb-2 text-center text-xs font-medium text-slate-500">Bukti Pembayaran (opsional)</p>
                {buktiUrl ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative">
                      <img src={buktiUrl} alt="Bukti pembayaran QRIS" className="h-40 w-40 rounded-xl border border-slate-200 object-cover" />
                      <button
                        type="button"
                        onClick={() => setBuktiUrl('')}
                        aria-label="Hapus bukti"
                        className="absolute -right-2 -top-2 rounded-full bg-slate-900 p-1 text-white shadow hover:bg-slate-700"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <label className="cursor-pointer text-xs font-medium text-primary-600 hover:underline">
                      Ganti foto
                      <input type="file" accept="image/*" className="hidden" onChange={pilihBukti} disabled={uploadingBukti} />
                    </label>
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <Camera className="h-4 w-4" />
                      Foto Kamera
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pilihBukti} disabled={uploadingBukti} />
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <Upload className="h-4 w-4" />
                      Upload Foto
                      <input type="file" accept="image/*" className="hidden" onChange={pilihBukti} disabled={uploadingBukti} />
                    </label>
                  </div>
                )}
                {uploadingBukti && <p className="mt-2 text-center text-xs text-slate-500">Mengunggah...</p>}
              </div>
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
