'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { getJSON, sendJSON } from '../../../api'
import { PageSkeleton } from '../../ui'
import { useConfirm } from '@/components/confirm-dialog'
import type { TicketModalItem } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'

const input =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100'

const emptyForm = { id: '', nama: '', harga: '' }

export default function TicketModalPage() {
  const confirm = useConfirm()
  const [items, setItems] = useState<TicketModalItem[]>([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const data = await getJSON<TicketModalItem[]>('/api/ticket/modal')
    setItems(data)
    setError(null)
  }, [])

  useEffect(() => {
    load()
      .catch((e) => { setError('Gagal memuat data modal'); console.error(e) })
      .finally(() => setLoading(false))
  }, [load])

  const total = items.reduce((sum, item) => sum + Number(item.harga ?? 0), 0)

  async function simpan() {
    if (!form.nama.trim()) {
      toast.error('Nama item wajib diisi')
      return
    }
    const harga = Number(form.harga)
    if (!Number.isFinite(harga) || harga < 0) {
      toast.error('Harga modal tidak valid')
      return
    }
    setSaving(true)
    try {
      await sendJSON('/api/ticket/modal', 'POST', {
        ...(form.id ? { id: form.id } : {}),
        nama: form.nama.trim(),
        harga,
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

  async function hapus(item: TicketModalItem) {
    const ok = await confirm({
      title: 'Hapus item modal?',
      description: `"${item.nama}" akan dihapus dari perhitungan modal tiket.`,
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      await sendJSON('/api/ticket/modal', 'DELETE', { id: item.id })
      if (form.id === item.id) setForm(emptyForm)
      await load()
      toast.success('Item modal dihapus')
    } catch (e) {
      toast.error(String(e))
    }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Kelola Modal</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Kelola Modal</h1>
        <p className="text-sm text-slate-500">Daftar komponen biaya per tiket (gelang, sablon, packing, dll). Berlaku untuk semua tipe dan periode.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-primary-100 bg-primary-50/60 p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-100 text-primary-600">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-primary-700">Modal per Tiket</p>
            <p className="text-xl font-bold text-primary-800">{formatRupiah(total)}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Jumlah Item</p>
          <p className="text-xl font-bold text-slate-900">{items.length} item</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-900">{form.id ? 'Edit Item Modal' : 'Tambah Item Modal'}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px_auto]">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Nama Item</label>
            <input
              className={input}
              placeholder="Contoh: Gelang, Sablon, Packing"
              value={form.nama}
              onChange={(e) => setForm((prev) => ({ ...prev, nama: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Harga per Tiket</label>
            <input
              type="number"
              min={0}
              className={input}
              placeholder="0"
              value={form.harga}
              onChange={(e) => setForm((prev) => ({ ...prev, harga: e.target.value }))}
            />
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
        <table className="w-full min-w-[520px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Nama Item</th>
              <th className="px-4 py-3 font-medium text-slate-600">Harga / Tiket</th>
              <th className="px-4 py-3 font-medium text-slate-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center text-slate-400">
                  Belum ada item modal. Tambahkan biaya gelang di atas.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{item.nama}</td>
                <td className="px-4 py-3 text-primary-600">{formatRupiah(Number(item.harga))}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setForm({ id: item.id, nama: item.nama, harga: String(item.harga) })}
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
