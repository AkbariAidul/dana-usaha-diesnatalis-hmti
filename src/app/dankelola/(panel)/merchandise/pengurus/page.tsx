'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { PageSkeleton } from '../../ui'
import { useConfirm } from '@/components/confirm-dialog'
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react'

type Pengurus = {
  id: string
  nama: string
  divisi: string | null
  aktif: boolean
}

export default function PengurusPage() {
  const confirm = useConfirm()
  const [items, setItems] = useState<Pengurus[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  async function load() {
    try {
      setItems(await getJSON<Pengurus[]>('/api/pengurus'))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useLiveRefresh(load)

  useEffect(() => {
    setPage(1)
  }, [search])

  const filtered = items.filter((item) =>
    `${item.nama} ${item.divisi ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )
  const PER_PAGE = 10
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)

  async function toggle(item: Pengurus) {
    const aktif = !item.aktif
    setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, aktif } : p)))
    try {
      await sendJSON(`/api/pengurus/${item.id}`, 'PATCH', { aktif })
    } catch (e) {
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, aktif: item.aktif } : p)))
      toast.error((e as Error).message)
    }
  }

  async function hapus(item: Pengurus) {
    const ok = await confirm({
      title: 'Hapus pengurus?',
      description: `${item.nama} akan dihapus permanen.`,
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      await sendJSON(`/api/pengurus/${item.id}`, 'DELETE')
      toast.success('Pengurus dihapus')
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Data Pengurus</h1>
          <p className="text-sm text-slate-500">Daftar nama pengurus untuk pilihan PO merchandise.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari pengurus..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100 sm:w-64"
            />
          </div>
          <Link
            href="/dankelola/merchandise/pengurus/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> Tambah Pengurus
          </Link>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Nama</th>
                <th className="px-5 py-3">Divisi</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-400">
                    {items.length === 0 ? 'Belum ada data pengurus.' : 'Tidak ada pengurus yang cocok.'}
                  </td>
                </tr>
              )}
              {paginated.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-slate-50/70">
                  <td className="px-5 py-3 font-medium text-slate-900">{item.nama}</td>
                  <td className="px-5 py-3 text-slate-500">{item.divisi || '-'}</td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.aktif}
                      aria-label={item.aktif ? `Nonaktifkan ${item.nama}` : `Aktifkan ${item.nama}`}
                      title={item.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      onClick={() => toggle(item)}
                      className="group inline-flex items-center gap-2"
                    >
                      <span className={`relative h-5 w-9 rounded-full transition-colors ${item.aktif ? 'bg-green-500' : 'bg-slate-300'}`}>
                        <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${item.aktif ? 'translate-x-4' : 'translate-x-0'}`} />
                      </span>
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/dankelola/merchandise/pengurus/${item.id}/edit`}
                        aria-label={`Edit ${item.nama}`}
                        title="Edit"
                        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => hapus(item)}
                        aria-label={`Hapus ${item.nama}`}
                        title="Hapus"
                        className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Menampilkan {filtered.length === 0 ? 0 : (currentPage - 1) * PER_PAGE + 1}–{Math.min(currentPage * PER_PAGE, filtered.length)} dari {filtered.length} pengurus
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
      </section>
    </div>
  )
}
