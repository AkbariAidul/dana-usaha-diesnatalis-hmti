'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ChevronLeft, Pencil, Trash2 } from 'lucide-react'
import { getJSON, sendJSON } from '../../../../api'
import { PageSkeleton } from '../../../ui'
import type { KategoriSewa, HargaDasar, PeriodeHarga, Peralatan, KomposisiPeralatan } from '@/lib/types'
import { periodeDariTanggal } from '@/lib/types'
import { formatRupiah, formatDate, todayISO } from '@/lib/utils'
import { useConfirm } from '@/components/confirm-dialog'

type Master = { kategori: KategoriSewa[]; hargaDasar: HargaDasar[]; periode: PeriodeHarga[] }

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10 disabled:bg-slate-50 disabled:text-slate-500'
const label = 'mb-1 block text-xs font-medium text-slate-500'

const emptyPeriode = { id: '', nama: '', tanggal_mulai: '', tanggal_selesai: '', harga: '' }

export default function PaketHargaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const confirm = useConfirm()
  const isNew = id === 'new'
  const [paket, setPaket] = useState<KategoriSewa | null>(null)
  const [hargaDasar, setHargaDasar] = useState<HargaDasar[]>([])
  const [periods, setPeriods] = useState<PeriodeHarga[]>([])
  const [peralatan, setPeralatan] = useState<Peralatan[]>([])
  const [komposisi, setKomposisi] = useState<KomposisiPeralatan>({})
  const [form, setForm] = useState({ nama: '', keterangan: '', include_listrik: true, include_trashbag: true })
  const [periodForm, setPeriodForm] = useState(emptyPeriode)
  const [komposisiEdits, setKomposisiEdits] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingInfo, setSavingInfo] = useState(false)
  const [savingPeriode, setSavingPeriode] = useState(false)
  const [savingKomposisi, setSavingKomposisi] = useState(false)

  useEffect(() => {
    if (isNew) { setLoading(false); return }
    if (!id) return
    ;(async () => {
      const [m, items, komp] = await Promise.all([
        getJSON<Master>('/api/master'),
        getJSON<Peralatan[]>('/api/peralatan'),
        getJSON<KomposisiPeralatan>('/api/peralatan/komposisi'),
      ])
      const found = (m.kategori || []).find((k) => k.id === id)
      if (!found) { toast.error('Paket tidak ditemukan'); return }
      setPaket(found)
      setForm({
        nama: found.nama,
        keterangan: found.keterangan ?? '',
        include_listrik: found.include_listrik,
        include_trashbag: found.include_trashbag,
      })
      setHargaDasar(m.hargaDasar || [])
      setPeriods(m.periode || [])
      setPeralatan(items || [])
      setKomposisi(komp || {})
    })()
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const activeKode = periodeDariTanggal(todayISO(), periods)

  const hargaByKode = useMemo(() => {
    const map = new Map<string, HargaDasar>()
    for (const h of hargaDasar) {
      if (h.kategori_sewa_id !== id) continue
      if (!map.has(h.periode) || h.jenis_usaha === 'F&B') map.set(h.periode, h)
    }
    return map
  }, [hargaDasar, id])

  function qtyKomposisi(peralatanId: string) {
    if (komposisiEdits[peralatanId] !== undefined) return Number(komposisiEdits[peralatanId]) || 0
    return komposisi[id]?.[peralatanId] || 0
  }

  const modal = useMemo(() => {
    return peralatan.reduce((sum, item) => sum + qtyKomposisi(item.id) * Number(item.harga_satuan), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peralatan, komposisi, komposisiEdits, id])

  async function simpanInfo() {
    if (!form.nama.trim()) { toast.error('Nama paket wajib diisi'); return }
    setSavingInfo(true)
    try {
      const saved = await sendJSON('/api/master/kategori', 'POST', {
        ...(paket ? { id: paket.id } : {}),
        nama: form.nama.trim(),
        keterangan: form.keterangan.trim(),
        include_listrik: form.include_listrik,
        include_trashbag: form.include_trashbag,
      }) as KategoriSewa
      if (!paket) {
        toast.success('Paket dibuat. Atur periode harga di bawah.')
        router.push(`/dankelola/tenants/harga/${saved.id}`)
        return
      }
      setPaket(saved)
      setForm({
        nama: saved.nama,
        keterangan: saved.keterangan ?? '',
        include_listrik: saved.include_listrik,
        include_trashbag: saved.include_trashbag,
      })
      toast.success('Paket diperbarui')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingInfo(false)
    }
  }

  async function reloadHarga() {
    const m = await getJSON<Master>('/api/master')
    setHargaDasar(m.hargaDasar || [])
    setPeriods(m.periode || [])
  }

  function resetPeriodeForm() {
    setPeriodForm(emptyPeriode)
  }

  function editPeriode(p: PeriodeHarga) {
    const existing = hargaByKode.get(p.kode)
    setPeriodForm({
      id: p.id,
      nama: p.nama,
      tanggal_mulai: p.tanggal_mulai,
      tanggal_selesai: p.tanggal_selesai,
      harga: existing ? String(existing.harga) : '',
    })
  }

  async function simpanPeriode() {
    if (!periodForm.nama.trim()) { toast.error('Nama periode wajib diisi'); return }
    if (!periodForm.tanggal_mulai || !periodForm.tanggal_selesai) { toast.error('Tanggal wajib diisi'); return }
    if (periodForm.tanggal_selesai < periodForm.tanggal_mulai) { toast.error('Tanggal selesai harus setelah mulai'); return }
    const harga = Number(periodForm.harga)
    if (!periodForm.harga.trim() || !Number.isFinite(harga) || harga < 0) { toast.error('Harga wajib diisi'); return }
    setSavingPeriode(true)
    try {
      const saved = await sendJSON('/api/master/periode', 'POST', {
        ...(periodForm.id ? { id: periodForm.id } : {}),
        nama: periodForm.nama.trim(),
        tanggal_mulai: periodForm.tanggal_mulai,
        tanggal_selesai: periodForm.tanggal_selesai,
      }) as PeriodeHarga
      for (const jenis of ['F&B', 'Non-F&B'] as const) {
        const existing = hargaDasar.find((h) => h.kategori_sewa_id === id && h.periode === saved.kode && h.jenis_usaha === jenis)
        if (existing && Number(existing.harga) === harga) continue
        await sendJSON('/api/master/harga', 'POST', {
          id: existing?.id,
          kategori_sewa_id: id,
          jenis_usaha: jenis,
          periode: saved.kode,
          harga,
        })
      }
      await reloadHarga()
      resetPeriodeForm()
      toast.success(periodForm.id ? 'Periode diperbarui' : 'Periode harga ditambahkan')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingPeriode(false)
    }
  }

  async function hapusPeriode(p: PeriodeHarga) {
    const ok = await confirm({
      title: 'Hapus periode harga?',
      description: `Periode ${p.nama} dan harga semua paket pada periode ini ikut terhapus.`,
      confirmText: 'Hapus',
    })
    if (!ok) return
    try {
      await sendJSON('/api/master/periode', 'DELETE', { id: p.id })
      if (periodForm.id === p.id) resetPeriodeForm()
      await reloadHarga()
      toast.success('Periode dihapus')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function simpanKomposisi() {
    const row: Record<string, number> = {}
    for (const item of peralatan) {
      const qty = qtyKomposisi(item.id)
      if (qty > 0) row[item.id] = qty
    }
    const next: KomposisiPeralatan = { ...komposisi }
    if (Object.keys(row).length > 0) next[id] = row
    else delete next[id]
    setSavingKomposisi(true)
    try {
      const saved = await sendJSON('/api/peralatan/komposisi', 'POST', next) as KomposisiPeralatan
      setKomposisi(saved)
      setKomposisiEdits({})
      toast.success('Komposisi modal disimpan')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingKomposisi(false)
    }
  }

  if (loading) return <PageSkeleton />
  if (!paket && !isNew) {
    return (
      <div className="space-y-3">
        <p className="text-red-600">Paket tidak ditemukan.</p>
        <Link href="/dankelola/tenants/harga" className="text-sm text-primary-600 hover:underline">← Kembali</Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dankelola/tenants/harga" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline">
          <ChevronLeft className="h-4 w-4" /> Kembali
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{paket ? paket.nama : 'Tambah Paket'}</h1>
          <p className="text-sm text-slate-500">
            {paket ? 'Atur informasi paket, periode harga, dan modal sewa.' : 'Buat paket tenant baru, lalu atur periode harganya.'}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Informasi Paket</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={label}>Kode</label>
            <input disabled className={input} value={paket?.kode ?? 'Otomatis'} />
          </div>
          <div>
            <label className={label}>Nama Paket</label>
            <input className={input} value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
          </div>
        </div>
        <div>
          <label className={label}>Keterangan</label>
          <textarea rows={2} className={input} value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.include_listrik} onChange={(e) => setForm({ ...form, include_listrik: e.target.checked })} />
            <span>Termasuk listrik</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.include_trashbag} onChange={(e) => setForm({ ...form, include_trashbag: e.target.checked })} />
            <span>Termasuk trashbag</span>
          </label>
        </div>
        <div className="flex justify-end">
          <button disabled={savingInfo} onClick={simpanInfo} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {savingInfo ? 'Menyimpan...' : paket ? 'Simpan Info' : 'Tambah Paket'}
          </button>
        </div>
      </div>

      {paket && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-3">
          <div>
            <h2 className="font-semibold text-slate-900">Periode Harga</h2>
            <p className="text-sm text-slate-500">Satu harga total per periode. Berlaku untuk F&B dan Non-F&B.</p>
          </div>
          {periods.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada periode harga.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Nama</th>
                    <th className="px-3 py-2">Periode</th>
                    <th className="px-3 py-2">Harga</th>
                    <th className="px-3 py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {periods.map((p) => {
                    const existing = hargaByKode.get(p.kode)
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium">
                          {p.nama || '-'}
                          {p.kode === activeKode && <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">Berjalan</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{formatDate(p.tanggal_mulai)} – {formatDate(p.tanggal_selesai)}</td>
                        <td className="px-3 py-2 font-semibold text-primary-600">
                          {existing ? formatRupiah(existing.harga) : <span className="text-slate-400">Belum diatur</span>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => editPeriode(p)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary-600" title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => hapusPeriode(p)} className="grid h-7 w-7 place-items-center rounded-lg text-red-500 transition-colors hover:bg-red-50 hover:text-red-600" title="Hapus">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-5 md:items-end">
            <div><label className={label}>Nama</label><input className={input} value={periodForm.nama} onChange={(e) => setPeriodForm({ ...periodForm, nama: e.target.value })} placeholder="Early Bird" /></div>
            <div><label className={label}>Mulai</label><input type="date" className={input} value={periodForm.tanggal_mulai} onChange={(e) => setPeriodForm({ ...periodForm, tanggal_mulai: e.target.value })} /></div>
            <div><label className={label}>Selesai</label><input type="date" className={input} value={periodForm.tanggal_selesai} onChange={(e) => setPeriodForm({ ...periodForm, tanggal_selesai: e.target.value })} /></div>
            <div><label className={label}>Harga (Rp)</label><input type="number" min={0} className={input} placeholder="cth: 500000" value={periodForm.harga} onChange={(e) => setPeriodForm({ ...periodForm, harga: e.target.value })} /></div>
            <div className="flex gap-2">
              <button onClick={simpanPeriode} disabled={savingPeriode} className="flex-1 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {savingPeriode ? 'Menyimpan...' : periodForm.id ? 'Simpan' : '+ Tambah Periode'}
              </button>
              {periodForm.id && <button onClick={resetPeriodeForm} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">Batal</button>}
            </div>
          </div>
        </div>
      )}

      {paket && (
      <>
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-3">
        <div>
          <h2 className="font-semibold text-slate-900">Komposisi Modal Paket</h2>
          <p className="text-sm text-slate-500">Jumlah barang sewa yang dipakai paket ini. Modal dihitung dari harga sewa vendor.</p>
        </div>
        {peralatan.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Belum ada barang sewa. Tambahkan dulu di <Link href="/dankelola/tenants/peralatan" className="text-primary-600 hover:underline">Sewa Vendor</Link>.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Barang</th>
                    <th className="px-3 py-2 text-right">Harga / Unit</th>
                    <th className="px-3 py-2 text-center">Qty</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {peralatan.map((item) => {
                    const qty = qtyKomposisi(item.id)
                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-2">
                          <p className="font-medium">{item.nama}</p>
                          <p className="text-xs text-slate-400">{item.jenis}{item.vendor ? ` · ${item.vendor}` : ''}</p>
                        </td>
                        <td className="px-3 py-2 text-right">{formatRupiah(item.harga_satuan)}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={0}
                            className={`${input} mx-auto w-20 text-center`}
                            placeholder="0"
                            value={komposisiEdits[item.id] ?? (komposisi[id]?.[item.id] ? String(komposisi[id][item.id]) : '')}
                            onChange={(e) => setKomposisiEdits({ ...komposisiEdits, [item.id]: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">{formatRupiah(qty * Number(item.harga_satuan))}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold">
                  <tr>
                    <td className="px-3 py-2" colSpan={3}>Modal Paket</td>
                    <td className="px-3 py-2 text-right">{formatRupiah(modal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex justify-end">
              <button disabled={savingKomposisi} onClick={simpanKomposisi} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {savingKomposisi ? 'Menyimpan...' : 'Simpan Komposisi'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-3">
        <div>
          <h2 className="font-semibold text-slate-900">Keuntungan per Periode</h2>
          <p className="text-sm text-slate-500">Harga jual dikurangi modal paket.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2">Periode</th>
                <th className="px-3 py-2 text-right">Modal Paket</th>
                <th className="px-3 py-2 text-right">Harga Sewa</th>
                <th className="px-3 py-2 text-right">Untung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {periods.map((p) => {
                const harga = hargaByKode.get(p.kode)
                const laba = (harga ? Number(harga.harga) : 0) - modal
                return (
                  <tr key={p.id}>
                    <td className="px-3 py-2 font-medium">{p.nama}</td>
                    <td className="px-3 py-2 text-right">{formatRupiah(modal)}</td>
                    <td className="px-3 py-2 text-right">{harga ? formatRupiah(harga.harga) : <span className="text-slate-400">-</span>}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${!harga ? 'text-slate-400' : laba >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {harga ? formatRupiah(laba) : '-'}
                    </td>
                  </tr>
                )
              })}
              {periods.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Belum ada periode.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  )
}
