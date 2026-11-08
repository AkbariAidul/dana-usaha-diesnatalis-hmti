import { supabaseAdmin } from './supabase'
import {
  getAcara,
  getHargaDasar,
  getKategoriBundleDiscount,
  getKategoriSewa,
  getPeriodeHarga,
} from './queries'
import { periodeDariTanggal, type KategoriSewa, type TenantAddon } from './types'
import { getPeralatanMeta } from './peralatan'
import { todayISO } from './utils'

export type BodyPendaftaran = {
  nama_usaha?: string
  kontak?: string
  email?: string
  alamat?: string
  deskripsi_usaha?: string
  kategori_sewa_id?: string
  jenis_usaha?: string
  jenis_usaha_qty?: { fnb?: unknown; nonFnb?: unknown }
  jumlah_tenant?: unknown
  addon?: Array<{ id?: string; qty?: number }>
  pilihan?: Array<{ id?: string; qty?: number }>
}

export type HasilPendaftaran = {
  tglDaftar: string
  periode: string
  qtyFnb: number
  qtyNonFnb: number
  jumlahTenant: number
  jenisUsaha: 'F&B' | 'Non-F&B'
  addon: TenantAddon[]
  harga: number
  lokasi: string
  tglAcara: string | null
  kategori: KategoriSewa
}

export class PendaftaranError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export async function hitungPendaftaran(body: BodyPendaftaran): Promise<HasilPendaftaran> {
  const tglDaftar = todayISO()
  const [periods, hargaDasar, kategori, acara, bundles] = await Promise.all([
    getPeriodeHarga(),
    getHargaDasar(),
    getKategoriSewa(),
    getAcara(),
    getKategoriBundleDiscount(),
  ])
  const periode = periodeDariTanggal(tglDaftar, periods)
  if (!periode) throw new PendaftaranError('Tanggal daftar di luar periode open tenant')

  const qtyRaw = body.jenis_usaha_qty
  let qtyFnb: number
  let qtyNonFnb: number
  if (qtyRaw && (qtyRaw.fnb !== undefined || qtyRaw.nonFnb !== undefined)) {
    qtyFnb = Math.max(0, Math.min(99, Number(qtyRaw.fnb) || 0))
    qtyNonFnb = Math.max(0, Math.min(99, Number(qtyRaw.nonFnb) || 0))
  } else {
    // Kompatibilitas klien lama: satu jenis usaha + jumlah tenant.
    const jumlah = Math.max(1, Math.min(99, Number(body.jumlah_tenant) || 1))
    if (body.jenis_usaha === 'Non-F&B') {
      qtyFnb = 0
      qtyNonFnb = jumlah
    } else {
      qtyFnb = jumlah
      qtyNonFnb = 0
    }
  }
  const jumlahTenant = qtyFnb + qtyNonFnb
  if (jumlahTenant < 1) throw new PendaftaranError('Jumlah tenant minimal 1')

  const hargaUntuk = (jenis: 'F&B' | 'Non-F&B') =>
    hargaDasar.find((h) => h.kategori_sewa_id === body.kategori_sewa_id && h.jenis_usaha === jenis && h.periode === periode)
  const hargaFnbItem = qtyFnb > 0 ? hargaUntuk('F&B') : null
  const hargaNonFnbItem = qtyNonFnb > 0 ? hargaUntuk('Non-F&B') : null
  if (qtyFnb > 0 && !hargaFnbItem) {
    throw new PendaftaranError('Harga F&B untuk kategori dan periode ini belum diatur')
  }
  if (qtyNonFnb > 0 && !hargaNonFnbItem) {
    throw new PendaftaranError('Harga Non-F&B untuk kategori dan periode ini belum diatur')
  }
  const jenisUsaha = qtyNonFnb > qtyFnb ? 'Non-F&B' : 'F&B'
  const kategoriItem = kategori.find((k) => k.id === body.kategori_sewa_id)
  if (!kategoriItem) throw new PendaftaranError('Kategori tidak ditemukan')
  if (kategoriItem.aktif === false) throw new PendaftaranError('Paket tenant ini sedang tidak aktif')

  const addonReq = Array.isArray(body.addon) ? body.addon.slice(0, 20) : []
  let addon: TenantAddon[] = []
  if (addonReq.length > 0) {
    const ids = addonReq.map((a) => a.id).filter(Boolean)
    const [{ data: items }, meta] = await Promise.all([
      supabaseAdmin.from('peralatan').select('id, nama').in('id', ids),
      getPeralatanMeta(),
    ])
    const byId = new Map((items ?? []).map((item: { id: string; nama: string }) => [item.id, item]))
    addon = addonReq
      .map((a) => {
        const item = a.id ? byId.get(a.id) : undefined
        const hargaSatuan = Number(meta[a.id ?? '']?.harga_sewa ?? 0)
        const qty = Math.max(1, Math.min(99, Number(a.qty) || 1))
        if (!item || hargaSatuan <= 0) return null
        return {
          id: item.id,
          nama: item.nama,
          qty,
          harga_satuan: hargaSatuan,
          subtotal: hargaSatuan * qty,
        }
      })
      .filter((a: TenantAddon | null): a is TenantAddon => a !== null)
  }
  const addonLainTotal = addon.reduce((sum, a) => sum + a.subtotal, 0)

  const pilihanReq = Array.isArray(body.pilihan)
    ? body.pilihan
        .map((p) => ({ id: String(p.id ?? ''), qty: Math.max(1, Math.min(99, Number(p.qty) || 1)) }))
        .filter((p) => p.id)
        .slice(0, 20)
    : []
  let pilihanTotal = 0
  if (pilihanReq.length > 0) {
    const ids = pilihanReq.map((p) => p.id)
    const { data: items } = await supabaseAdmin
      .from('kategori_pilihan')
      .select('id, nama, harga, kategori_sewa_id')
      .in('id', ids)
    const byId = new Map((items ?? []).map((item: { id: string; nama: string; harga: number; kategori_sewa_id: string }) => [item.id, item]))
    const pilihanAddon = pilihanReq
      .map((req) => {
        const item = byId.get(req.id)
        if (!item || item.kategori_sewa_id !== body.kategori_sewa_id) return null
        if (/^tempat\b/i.test(item.nama.trim())) return null
        const hargaSatuan = Number(item.harga)
        const subtotal = hargaSatuan * req.qty
        pilihanTotal += subtotal
        return {
          id: item.id,
          nama: item.nama,
          qty: req.qty,
          harga_satuan: hargaSatuan,
          subtotal,
        }
      })
      .filter((a: TenantAddon | null): a is TenantAddon => a !== null)
    addon = [...addon, ...pilihanAddon]
  }

  const lokasi = kategoriItem.kode === 'KT-02' ? 'Strategis 1' : 'Reguler'
  const subtotalPaket =
    Number(hargaFnbItem?.harga ?? 0) * qtyFnb +
    Number(hargaNonFnbItem?.harga ?? 0) * qtyNonFnb +
    pilihanTotal
  const bundle = [...bundles]
    .filter((b) => b.kategori_sewa_id === body.kategori_sewa_id && jumlahTenant >= Number(b.jumlah_min))
    .sort((a, b) => Number(b.jumlah_min) - Number(a.jumlah_min))[0]
  const diskon = bundle
    ? Math.min(subtotalPaket, Number(bundle.diskon_nominal) + subtotalPaket * (Number(bundle.diskon_persen) / 100))
    : 0
  const harga = Math.max(0, Math.round(subtotalPaket - diskon) + addonLainTotal)

  return {
    tglDaftar,
    periode,
    qtyFnb,
    qtyNonFnb,
    jumlahTenant,
    jenisUsaha,
    addon,
    harga,
    lokasi,
    tglAcara: acara?.tanggal_acara ?? null,
    kategori: kategoriItem,
  }
}
