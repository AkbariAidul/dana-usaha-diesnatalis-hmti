import { supabaseAdmin } from '@/lib/supabase'
import type { Bundle, BundleItem } from '@/lib/types'

// Tanggal dari form admin berupa YYYY-MM-DD tanpa zona waktu. Perlakukan
// sebagai hari penuh WIB, bukan tengah malam UTC.
function batasHari(value: string, akhir: boolean) {
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return new Date(value).getTime()
  const tanggal = value.slice(0, 10)
  return new Date(`${tanggal}T${akhir ? '23:59:59.999' : '00:00:00.000'}+07:00`).getTime()
}

/** Apakah paket sedang bisa dibeli (aktif + dalam periode). Kuota dicek terpisah. */
export function bundleSedangBuka(bundle: Pick<Bundle, 'aktif' | 'tgl_mulai' | 'tgl_selesai'>, now = new Date()) {
  if (!bundle.aktif) return false
  const waktu = now.getTime()
  if (bundle.tgl_mulai && waktu < batasHari(bundle.tgl_mulai, false)) return false
  if (bundle.tgl_selesai && waktu > batasHari(bundle.tgl_selesai, true)) return false
  return true
}

/** Jumlah order paket yang masih dihitung (bukan ditolak/batal). */
export async function hitungKuotaBundleTerpakai(bundleId: string) {
  const { count } = await supabaseAdmin
    .from('bundle_order')
    .select('*', { count: 'exact', head: true })
    .eq('bundle_id', bundleId)
    .in('status', ['menunggu_verifikasi', 'lunas'])
  return count ?? 0
}

/**
 * Ambil daftar paket beserta isinya. `nama` & `harga_satuan` pada item diisi
 * untuk keperluan tampilan (harga normal sebagai pembanding harga paket).
 */
export async function getBundles(onlyAktif = false): Promise<Bundle[]> {
  let query = supabaseAdmin.from('bundle').select('*').order('urutan').order('nama')
  if (onlyAktif) query = query.eq('aktif', true)
  const { data: bundleRows, error } = await query
  if (error) throw error

  const bundles = (bundleRows ?? []) as Bundle[]
  const ids = bundles.map((b) => b.id)
  if (ids.length === 0) return []

  const { data: itemRows } = await supabaseAdmin
    .from('bundle_item')
    .select('*')
    .in('bundle_id', ids)
    .order('urutan')
  const items = (itemRows ?? []) as BundleItem[]

  const tipeIds = items.filter((i) => i.tipe === 'tiket').map((i) => i.ref_id)
  const merchIds = items.filter((i) => i.tipe === 'merch').map((i) => i.ref_id)

  const [{ data: tipe }, { data: merch }] = await Promise.all([
    tipeIds.length
      ? supabaseAdmin.from('tiket_tipe').select('id,nama,harga').in('id', tipeIds)
      : Promise.resolve({ data: [] as { id: string; nama: string; harga: number }[] }),
    merchIds.length
      ? supabaseAdmin.from('merchandise').select('id,nama,harga,harga_po,harga_po_umum').in('id', merchIds)
      : Promise.resolve({ data: [] as { id: string; nama: string; harga: number; harga_po: number | null; harga_po_umum: number | null }[] }),
  ])

  const tipeMap = new Map((tipe ?? []).map((t) => [t.id, t]))
  const merchMap = new Map((merch ?? []).map((m) => [m.id, m]))

  return bundles.map((b) => ({
    ...b,
    items: items
      .filter((i) => i.bundle_id === b.id)
      .map((i) => {
        if (i.tipe === 'tiket') {
          const t = tipeMap.get(i.ref_id)
          return { ...i, nama: t?.nama ?? 'Tiket', harga_satuan: Number(t?.harga ?? 0) }
        }
        const m = merchMap.get(i.ref_id)
        const harga = Number(m?.harga_po_umum ?? m?.harga_po ?? m?.harga ?? 0)
        return { ...i, nama: m?.nama ?? 'Merchandise', harga_satuan: harga }
      }),
  }))
}

/** Total harga normal komponen (untuk menampilkan penghematan). */
export function totalHargaKomponen(items: BundleItem[]) {
  return items.reduce((sum, i) => sum + Number(i.harga_satuan ?? 0) * Number(i.qty ?? 0), 0)
}
