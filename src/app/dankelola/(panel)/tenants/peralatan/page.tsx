'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { DataError } from '@/components/data-error'
import { getJSON, sendJSON } from '../../../api'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { useIsViewer } from '@/lib/dashboard-user'
import { PageSkeleton } from '../../ui'
import type { KategoriPilihan, Tenant } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'

type ModalMap = Record<string, number>

type VendorItem = {
  key: string
  nama: string
  qty: number
  hargaSewa: number
  modalUnit: number
  totalModal: number
  keuntungan: number
  jumlahTenant: number
}

function kunci(nama: string) {
  return nama.trim().toLowerCase().replace(/\s+/g, ' ')
}

export default function PeralatanPage() {
  const isViewer = useIsViewer()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [pilihan, setPilihan] = useState<KategoriPilihan[]>([])
  const [modalMap, setModalMap] = useState<ModalMap>({})
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [t, p, m] = await Promise.all([
      getJSON<Tenant[]>('/api/tenants'),
      getJSON<KategoriPilihan[]>('/api/tenant/pilihan').catch(() => [] as KategoriPilihan[]),
      getJSON<ModalMap>('/api/tenant/pilihan-modal').catch(() => ({} as ModalMap)),
    ])
    const aktif = (t || []).filter((tenant) => tenant.status !== 'batal')
    setTenants(aktif)
    setPilihan(p || [])
    setModalMap(m || {})
    setDraft((prev) => {
      const next = { ...prev }
      for (const tenant of aktif) {
        for (const addon of tenant.addon ?? []) {
          const key = kunci(addon.nama)
          if (key && next[key] === undefined) next[key] = String(m?.[key] ?? 0)
        }
      }
      return next
    })
  }, [])

  useEffect(() => {
    load()
      .catch((e) => {
        console.error('Failed to load sewa vendor:', e)
        setError('Gagal memuat kebutuhan sewa vendor')
      })
      .finally(() => setLoading(false))
  }, [load])
  useLiveRefresh(load)

  const items = useMemo(() => {
    const pilihanIds = new Set(pilihan.map((item) => item.id))
    const map = new Map<string, VendorItem>()
    for (const tenant of tenants) {
      const jumlahTenant = Math.max(1, Number(tenant.jumlah_tenant ?? 1))
      for (const addon of tenant.addon ?? []) {
        const nama = String(addon.nama ?? '').trim()
        const key = kunci(nama)
        if (!key) continue
        const perTenant = pilihanIds.has(addon.id)
        const qty = Math.max(0, Number(addon.qty ?? 0)) * (perTenant ? jumlahTenant : 1)
        const hargaSewa = Number(addon.subtotal ?? Number(addon.harga_satuan ?? 0) * Number(addon.qty ?? 0))
        const modalUnit = Math.max(0, Number(draft[key] ?? modalMap[key] ?? 0) || 0)
        const current = map.get(key) ?? {
          key,
          nama,
          qty: 0,
          hargaSewa: 0,
          modalUnit,
          totalModal: 0,
          keuntungan: 0,
          jumlahTenant: 0,
        }
        current.qty += qty
        current.hargaSewa += hargaSewa
        current.modalUnit = modalUnit
        current.totalModal = current.modalUnit * current.qty
        current.keuntungan = current.hargaSewa - current.totalModal
        current.jumlahTenant += perTenant ? jumlahTenant : 1
        map.set(key, current)
      }
    }
    return [...map.values()].sort((a, b) => a.nama.localeCompare(b.nama))
  }, [tenants, pilihan, modalMap, draft])

  async function simpanModal(item: VendorItem) {
    if (isViewer) return
    const modal = Math.max(0, Number(draft[item.key] ?? 0) || 0)
    setSavingKey(item.key)
    try {
      const map = await sendJSON('/api/tenant/pilihan-modal', 'POST', { nama: item.nama, modal }) as ModalMap
      setModalMap(map)
      setDraft((prev) => ({ ...prev, [item.key]: String(modal) }))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) return <PageSkeleton />
  if (error) return (
    <div className="flex justify-center">
      <DataError title={error} />
    </div>
  )

  const totalUnit = items.reduce((sum, item) => sum + item.qty, 0)
  const totalModal = items.reduce((sum, item) => sum + item.totalModal, 0)
  const totalHargaSewa = items.reduce((sum, item) => sum + item.hargaSewa, 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sewa Vendor</h1>
        <p className="text-sm text-slate-500">
          Kebutuhan barang dari pilihan paket tenant. Isi modal sewa vendor per unit untuk melihat keuntungan.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Jenis Item</p>
          <p className="text-3xl font-bold text-slate-900">{items.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Unit</p>
          <p className="text-3xl font-bold text-primary-600">{totalUnit}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Total Modal</p>
          <p className="text-3xl font-bold text-red-600">{formatRupiah(totalModal)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm text-slate-500">Estimasi Keuntungan</p>
          <p className="text-3xl font-bold text-emerald-600">{formatRupiah(totalHargaSewa - totalModal)}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3">Barang</th>
              <th className="px-5 py-3 text-right">Jumlah</th>
              <th className="px-5 py-3 text-right">Modal / Unit</th>
              <th className="px-5 py-3 text-right">Total Modal</th>
              <th className="px-5 py-3 text-right">Harga Sewa</th>
              <th className="px-5 py-3 text-right">Keuntungan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                  Belum ada item dari pilihan paket tenant.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.key} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-900">{item.nama}</p>
                  <p className="text-xs text-slate-400">{item.jumlahTenant} tenant memilih</p>
                </td>
                <td className="px-5 py-3 text-right tabular-nums">{item.qty}</td>
                <td className="px-5 py-3 text-right">
                  <input
                    type="number"
                    min={0}
                    value={draft[item.key] ?? ''}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [item.key]: e.target.value }))}
                    onBlur={() => void simpanModal(item)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    disabled={isViewer || savingKey === item.key}
                    className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm tabular-nums focus:border-primary-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                    placeholder="0"
                  />
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-red-600">{formatRupiah(item.totalModal)}</td>
                <td className="px-5 py-3 text-right tabular-nums font-medium text-slate-900">{formatRupiah(item.hargaSewa)}</td>
                <td className={`px-5 py-3 text-right tabular-nums font-semibold ${item.keuntungan >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatRupiah(item.keuntungan)}
                </td>
              </tr>
            ))}
          </tbody>
          {items.length > 0 && (
            <tfoot className="bg-slate-50 font-semibold">
              <tr>
                <td className="px-5 py-3" colSpan={3}>Total</td>
                <td className="px-5 py-3 text-right tabular-nums text-red-600">{formatRupiah(totalModal)}</td>
                <td className="px-5 py-3 text-right tabular-nums">{formatRupiah(totalHargaSewa)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-emerald-700">{formatRupiah(totalHargaSewa - totalModal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-xs text-slate-500">
        {isViewer
          ? 'Mode lihat saja: kolom modal tidak bisa diubah.'
          : 'Modal otomatis tersimpan saat kolom modal selesai diisi.'}{' '}
        Data item diambil dari pilihan paket pada pendaftaran tenant yang sudah diterima.
      </p>
    </div>
  )
}
