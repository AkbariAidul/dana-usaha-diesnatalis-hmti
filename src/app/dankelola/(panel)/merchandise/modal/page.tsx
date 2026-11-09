'use client'

import { DataError } from '@/components/data-error'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { getJSON, sendJSON } from '../../../api'
import { PageSkeleton } from '../../ui'
import { useConfirm } from '@/components/confirm-dialog'
import type { MerchModalItem } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'

const input =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100'

const emptyForm = {
  id: '',
  nama: '',
  harga: '',
  harga_pengurus_pendek: '',
  harga_pengurus_panjang: '',
  harga_umum_pendek: '',
  harga_umum_panjang: '',
}

export default function MerchModalPage() {
  const confirm = useConfirm()
  const [items, setItems] = useState<MerchModalItem[]>([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  type RawModalItem = MerchModalItem & {
    harga_pengurus_pendek?: number
    harga_pengurus_panjang?: number
    harga_umum_pendek?: number
    harga_umum_panjang?: number
  }

  const load = useCallback(async () => {
    const data = await getJSON<RawModalItem[]>('/api/merchandise/modal')
    setItems(
      (data ?? []).map((i) => ({
        ...i,
        harga_pengurus_pendek: i.harga_pengurus_pendek ?? i.harga,
        harga_pengurus_panjang: i.harga_pengurus_panjang ?? i.harga,
        harga_umum_pendek: i.harga_umum_pendek ?? i.harga,
        harga_umum_panjang: i.harga_umum_panjang ?? i.harga,
      })),
    )
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => { setError('Gagal memuat data modal'); console.error(e) })
      .finally(() => setLoading(false))
  }, [load])

  const summary = useMemo(() => {
    const rows = items.map((item) => ({
      pengurus_pendek: Number(item.harga_pengurus_pendek ?? 0),
      pengurus_panjang: Number(item.harga_pengurus_panjang ?? 0),
      umum_pendek: Number(item.harga_umum_pendek ?? 0),
      umum_panjang: Number(item.harga_umum_panjang ?? 0),
    }))
    return {
      pengurus_pendek: rows.reduce((s, r) => s + r.pengurus_pendek, 0),
      pengurus_panjang: rows.reduce((s, r) => s + r.pengurus_panjang, 0),
      umum_pendek: rows.reduce((s, r) => s + r.umum_pendek, 0),
      umum_panjang: rows.reduce((s, r) => s + r.umum_panjang, 0),
    }
  }, [items])

  async function simpan() {
    if (!form.nama.trim()) {
      toast.error('Nama item wajib diisi')
      return
    }
    const parsed = [form.harga_pengurus_pendek, form.harga_pengurus_panjang, form.harga_umum_pendek, form.harga_umum_panjang].map((v) => Number(v))
    if (parsed.some((v) => !Number.isFinite(v) || v < 0)) {
      toast.error('Isi harga modal dengan angka yang valid')
      return
    }
    setSaving(true)
    try {
      await sendJSON('/api/merchandise/modal', 'POST', {
        ...(form.id ? { id: form.id } : {}),
        nama: form.nama.trim(),
        harga_pengurus_pendek: parsed[0],
        harga_pengurus_panjang: parsed[1],
        harga_umum_pendek: parsed[2],
        harga_umum_panjang: parsed[3],
      })
      setForm(emptyForm)
      await load()
      toast.success(form.id ? 'Item modal diperbarui' : 'Item modal ditambahkan')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function hapus(item: MerchModalItem) {
    const ok = await confirm({
      title: 'Hapus item modal?',
      description: `"${item.nama}" akan dihapus dari perhitungan modal merchandise.`,
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      await sendJSON('/api/merchandise/modal', 'DELETE', { id: item.id })
      if (form.id === item.id) setForm(emptyForm)
      await load()
      toast.success('Item modal dihapus')
    } catch (e) {
      toast.error(String(e))
    }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="flex justify-center">
      <DataError title={error} />
    </div>
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Kelola Modal</h1>
        <p className="text-sm text-slate-500">Daftar komponen biaya merchandise (bahan kaos, sablon, packing, dll). Berlaku untuk semua produk.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-primary-100 bg-primary-50/60 p-4">
          <p className="text-xs text-primary-700">Modal Pengurus · Pendek</p>
          <p className="mt-1 text-xl font-bold text-primary-800">{formatRupiah(summary.pengurus_pendek)}</p>
        </div>
        <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
          <p className="text-xs text-violet-700">Modal Pengurus · Panjang</p>
          <p className="mt-1 text-xl font-bold text-violet-800">{formatRupiah(summary.pengurus_panjang)}</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
          <p className="text-xs text-blue-700">Modal Umum · Pendek</p>
          <p className="mt-1 text-xl font-bold text-blue-800">{formatRupiah(summary.umum_pendek)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <p className="text-xs text-emerald-700">Modal Umum · Panjang</p>
          <p className="mt-1 text-xl font-bold text-emerald-800">{formatRupiah(summary.umum_panjang)}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">Jumlah Komponen Modal</p>
        <p className="text-xl font-bold text-slate-900">{items.length} item</p>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-900">{form.id ? 'Edit Item Modal' : 'Tambah Item Modal'}</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Nama Item</label>
            <input
              className={input}
              placeholder="Contoh: Bahan Kaos, Sablon, Packing"
              value={form.nama}
              onChange={(e) => setForm((prev) => ({ ...prev, nama: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Modal Pengurus · Pendek</label>
              <input
                type="number"
                min={0}
                className={input}
                placeholder="0"
                value={form.harga_pengurus_pendek}
                onChange={(e) => setForm((prev) => ({ ...prev, harga_pengurus_pendek: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Modal Pengurus · Panjang</label>
              <input
                type="number"
                min={0}
                className={input}
                placeholder="0"
                value={form.harga_pengurus_panjang}
                onChange={(e) => setForm((prev) => ({ ...prev, harga_pengurus_panjang: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Modal Umum · Pendek</label>
              <input
                type="number"
                min={0}
                className={input}
                placeholder="0"
                value={form.harga_umum_pendek}
                onChange={(e) => setForm((prev) => ({ ...prev, harga_umum_pendek: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Modal Umum · Panjang</label>
              <input
                type="number"
                min={0}
                className={input}
                placeholder="0"
                value={form.harga_umum_panjang}
                onChange={(e) => setForm((prev) => ({ ...prev, harga_umum_panjang: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={simpan}
              disabled={saving}
              className="inline-flex h-[38px] items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
            >
              {form.id ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? 'Menyimpan…' : form.id ? 'Simpan' : 'Tambah'}
            </button>
            {form.id && (
              <button
                onClick={() => setForm(emptyForm)}
                className="h-[38px] rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Batal
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Nama Item</th>
              <th className="px-4 py-3 font-medium text-slate-600">Pengurus · Pendek</th>
              <th className="px-4 py-3 font-medium text-slate-600">Pengurus · Panjang</th>
              <th className="px-4 py-3 font-medium text-slate-600">Umum · Pendek</th>
              <th className="px-4 py-3 font-medium text-slate-600">Umum · Panjang</th>
              <th className="px-4 py-3 font-medium text-slate-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  Belum ada item modal. Tambahkan komponen biaya di atas.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{item.nama}</td>
                <td className="px-4 py-3 text-primary-600">{formatRupiah(Number(item.harga_pengurus_pendek ?? 0))}</td>
                <td className="px-4 py-3 text-violet-600">{formatRupiah(Number(item.harga_pengurus_panjang ?? 0))}</td>
                <td className="px-4 py-3 text-blue-600">{formatRupiah(Number(item.harga_umum_pendek ?? 0))}</td>
                <td className="px-4 py-3 text-emerald-600">{formatRupiah(Number(item.harga_umum_panjang ?? 0))}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setForm({
                          id: item.id,
                          nama: item.nama,
                          harga: '',
                          harga_pengurus_pendek: String(item.harga_pengurus_pendek ?? 0),
                          harga_pengurus_panjang: String(item.harga_pengurus_panjang ?? 0),
                          harga_umum_pendek: String(item.harga_umum_pendek ?? 0),
                          harga_umum_panjang: String(item.harga_umum_panjang ?? 0),
                        })
                      }
                      className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary-600"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => hapus(item)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Hapus"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
