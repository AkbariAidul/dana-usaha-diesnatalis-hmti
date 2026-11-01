'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import type { Peralatan } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import { useConfirm } from '@/components/confirm-dialog'

const JENIS = ['Tenda', 'Meja', 'Kursi', 'Lilin', 'Generator', 'Sound', 'Lainnya']
const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10'
const emptyForm = { id: '', nama: '', jenis: 'Tenda', jumlah: 1, harga_satuan: 0, vendor: '' }

export default function PeralatanPage() {
  const confirm = useConfirm()
  const [items, setItems] = useState<Peralatan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  async function load() {
    setItems(await getJSON<Peralatan[]>('/api/peralatan'))
  }

  useEffect(() => {
    load()
      .catch((e) => {
        console.error('Failed to load peralatan:', e)
        setError('Gagal memuat data sewa vendor')
      })
      .finally(() => setLoading(false))
  }, [])
  useLiveRefresh(load)

  function bukaForm(item?: Peralatan) {
    setForm(item
      ? { id: item.id, nama: item.nama, jenis: item.jenis, jumlah: item.jumlah, harga_satuan: item.harga_satuan, vendor: item.vendor }
      : emptyForm)
    setShowForm(true)
  }

  async function simpan() {
    if (!form.nama) {
      toast.error('Nama barang harus diisi')
      return
    }
    setSaving(true)
    try {
      await sendJSON('/api/peralatan', 'POST', form)
      toast.success(form.id ? 'Barang diperbarui' : 'Barang ditambahkan')
      setForm(emptyForm)
      setShowForm(false)
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function hapus(item: Peralatan) {
    const ok = await confirm({
      title: 'Hapus barang sewa?',
      description: `${item.nama} akan dihapus dari daftar sewa vendor.`,
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      await sendJSON('/api/peralatan', 'DELETE', { id: item.id })
      toast.success('Barang dihapus')
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sewa Vendor</h1>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-red-700 hover:underline">Coba Lagi</button>
      </div>
    </div>
  )

  const totalUnit = items.reduce((sum, item) => sum + item.jumlah, 0)
  const totalModal = items.reduce((sum, item) => sum + item.jumlah * item.harga_satuan, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sewa Vendor</h1>
          <p className="text-sm text-slate-500">Barang yang disewa beserta jumlah dan harga sewanya.</p>
        </div>
        <button onClick={() => bukaForm()} className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700">+ Tambah Barang</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Jenis Barang</p>
          <p className="text-3xl font-bold text-slate-900">{items.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Unit</p>
          <p className="text-3xl font-bold text-primary-600">{totalUnit}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Modal Sewa</p>
          <p className="text-3xl font-bold text-red-600">{formatRupiah(totalModal)}</p>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <h2 className="font-semibold mb-4">{form.id ? 'Edit Barang Sewa' : 'Tambah Barang Sewa'}</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Nama Barang</label>
              <input className={input} placeholder="Tenda 3x3" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Vendor</label>
              <input className={input} placeholder="Nama vendor" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Jenis</label>
              <select className={input} value={form.jenis} onChange={e => setForm({ ...form, jenis: e.target.value })}>
                {JENIS.map(j => <option key={j}>{j}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Jumlah Sewa</label>
              <input type="number" min={1} className={input} value={form.jumlah} onChange={e => setForm({ ...form, jumlah: Number(e.target.value) })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Harga Sewa / Unit</label>
              <input type="number" min={0} className={input} value={form.harga_satuan} onChange={e => setForm({ ...form, harga_satuan: Number(e.target.value) })} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
            <button disabled={saving} onClick={simpan} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-xl disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Barang</th>
              <th className="px-3 py-2">Jenis</th>
              <th className="px-3 py-2 text-right">Jumlah</th>
              <th className="px-3 py-2 text-right">Harga / Unit</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {items.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Belum ada barang sewa.</td></tr>}
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <p className="font-medium">{item.nama}</p>
                  {item.vendor && <p className="text-xs text-slate-400">{item.vendor}</p>}
                </td>
                <td className="px-3 py-2">{item.jenis}</td>
                <td className="px-3 py-2 text-right">{item.jumlah}</td>
                <td className="px-3 py-2 text-right">{formatRupiah(item.harga_satuan)}</td>
                <td className="px-3 py-2 text-right font-medium">{formatRupiah(item.jumlah * item.harga_satuan)}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => bukaForm(item)} className="text-primary-600 hover:underline">Edit</button>
                    <button onClick={() => hapus(item)} className="text-red-600 hover:underline">Hapus</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {items.length > 0 && (
            <tfoot className="bg-slate-50 font-semibold">
              <tr>
                <td className="px-3 py-2" colSpan={4}>Total Modal Sewa</td>
                <td className="px-3 py-2 text-right">{formatRupiah(totalModal)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-sm text-slate-500">
        Atur pemakaian barang per paket di <Link href="/dankelola/tenants/harga" className="text-primary-600 hover:underline">Paket &amp; Harga</Link> untuk melihat keuntungan.
      </p>
    </div>
  )
}
