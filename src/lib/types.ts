export interface KategoriSewa {
  id: string
  kode: string
  nama: string
  keterangan: string
  thumbnail_url: string | null
  include_listrik: boolean
  include_trashbag: boolean
  slot_tenant: number
  aktif: boolean
  selisih_nonfnb: number
}

export interface KategoriPilihan {
  id: string
  kategori_sewa_id: string
  nama: string
  harga: number
  urutan: number
  gambar_url: string | null
}

export interface KategoriBundleDiscount {
  id: string
  kategori_sewa_id: string
  jumlah_min: number
  diskon_nominal: number
  diskon_persen: number
  urutan: number
}

export interface HargaDasar {
  id: string
  kategori_sewa_id: string
  jenis_usaha: 'F&B' | 'Non-F&B'
  periode: string
  harga: number
}

export interface PeriodeHarga {
  id: string
  kode: string
  nama: string
  tanggal_mulai: string
  tanggal_selesai: string
}

export interface FaktorHarga {
  id: string
  tipe: 'asal' | 'lokasi'
  nilai: string
  multiplier: number
}

export interface Peralatan {
  id: string
  nama: string
  jenis: string
  jumlah: number
  status: 'tersedia' | 'dipinjam' | 'rusak'
  harga_satuan: number
  harga_sewa?: number
  vendor: string
}

export type KomposisiPeralatan = Record<string, Record<string, number>>

export interface TenantAddon {
  id: string
  nama: string
  qty: number
  harga_satuan: number
  subtotal: number
}

export interface Tenant {
  id: string
  kode_stand: string
  nama_usaha: string
  kontak: string
  email: string | null
  kategori_sewa_id: string
  jenis_usaha: 'F&B' | 'Non-F&B'
  asal: 'Internal Kampus' | 'Eksternal'
  lokasi: 'Reguler' | 'Strategis 1' | 'Strategis 2'
  periode_daftar: 'early_bird' | 'reguler' | 'last_minute'
  harga_akhir: number
  dp_wajib: number
  sudah_dibayar: number
  jumlah_tenant: number
  tgl_daftar: string
  tgl_dp: string | null
  tgl_acara: string | null
  status: 'daftar' | 'dp' | 'cicil' | 'lunas' | 'batal' | 'menunggak'
  keterangan: string | null
  base_harga?: number
  addon?: TenantAddon[] | null
  kategori_sewa?: { kode: string; nama: string }
  venue_checked_in_at?: string | null
  venue_checked_in_by?: string | null
  qr?: string | null
}

export interface Pembayaran {
  id: string
  tenant_id: string
  no_transaksi: string
  tanggal_bayar: string
  jenis: 'DP' | 'Cicilan' | 'Pelunasan'
  nominal: number
  metode: string
  no_ref: string | null
  bukti_url: string | null
  dicatat_oleh: string | null
  keterangan: string | null
  validated: boolean
  tenants?: { kode_stand: string; nama_usaha: string }
}

export interface Acara {
  id: string
  nama: string
  tanggal_acara: string
  batas_pelunasan: string
  rekening_qris: string
}

export interface DiskonRule {
  min_qty: number
  tipe: 'persen' | 'nominal'
  nilai: number
  berlaku_po: boolean
  berlaku_hari_h: boolean
}

export interface Merchandise {
  id: string
  nama: string
  deskripsi: string | null
  warna: string | null
  harga: number
  stok: number
  stok_unlimited: boolean
  harga_po: number | null
  po_mulai: string | null
  po_selesai: string | null
  po_unlimited: boolean
  po_stok: number
  gambar_url: string | null
  aktif: boolean
  diskon: DiskonRule[] | null
  varian_ids: string[] | null
}

export interface Ticket {
  id: string
  nama: string
  deskripsi: string | null
  thumbnail_url: string | null
  harga: number
  jumlah_orang: number
  kuota: number
  terjual: number
  urutan: number
  aktif: boolean
  is_hari_h: boolean
  mulai_jual: string | null
  selesai_jual: string | null
}

export interface TicketPeriode {
  id: string
  tiket_tipe_id: string
  nama: string | null
  tanggal_mulai: string
  tanggal_selesai: string
  harga: number
  urutan: number
}

export interface TicketKatalogItem extends Ticket {
  harga_aktif: number
  periode_aktif: TicketPeriode | null
  periode: TicketPeriode[]
  pending: number
  sisa: number | null
  buka: boolean
  bundle_discounts: TicketBundleDiscount[]
}

export interface TicketBundleDiscount {
  id: string
  tiket_tipe_id: string
  jumlah_min: number
  diskon_persen: number
  urutan: number
}

export interface TicketModalItem {
  id: string
  nama: string
  harga: number
  urutan: number
}

export interface MerchModalItem {
  id: string
  nama: string
  harga: number
  urutan: number
}

export interface PesananTiket {
  id: string
  no_pesanan: string
  nama_pembeli: string
  kontak: string
  email: string | null
  tiket_nama: string | null
  periode_nama: string | null
  jumlah: number
  harga_satuan: number
  diskon_persen: number | null
  total: number
  status: 'menunggu_verifikasi' | 'lunas' | 'ditolak' | 'batal'
  bukti_url: string | null
  created_at: string
  modal_satuan: number
  modal_total: number
  keuntungan: number
}

// ─── Business Logic ───────────────────────────────────────────────────────────

export function hitungHarga(hargaDasar: number, faktorAsal: number, faktorLokasi: number): number {
  return Math.round(hargaDasar * faktorAsal * faktorLokasi)
}

export function hitungHariTersisa(tglAcara: string, tglDp: string): number {
  if (!tglAcara || !tglDp) return 0
  const acara = new Date(tglAcara)
  const dp = new Date(tglDp)
  const diff = Math.floor((acara.getTime() - dp.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff - 1)
}

export function hitungMinimalCicilan(hariTersisa: number, sisaTagihan: number): number {
  if (hariTersisa <= 0 || sisaTagihan <= 0) return 0
  return Math.ceil(sisaTagihan / hariTersisa)
}

export function hitungStatus(
  sudahDibayar: number,
  hargaAkhir: number,
  dpWajib: number,
  tglAcara: string | null
): 'daftar' | 'dp' | 'cicil' | 'lunas' | 'menunggak' {
  if (sudahDibayar >= hargaAkhir) return 'lunas'
  if (sudahDibayar <= 0) return 'daftar'
  if (tglAcara) {
    const today = new Date()
    const acara = new Date(tglAcara)
    if (today > acara) return 'menunggak'
  }
  if (sudahDibayar >= dpWajib) return 'cicil'
  return 'dp'
}

export type Periode = string

export function periodeDariTanggal(
  tgl: string,
  periods: Pick<PeriodeHarga, 'kode' | 'tanggal_mulai' | 'tanggal_selesai'>[]
): Periode | null {
  for (const p of periods) {
    if (tgl >= p.tanggal_mulai && tgl <= p.tanggal_selesai) return p.kode
  }
  return null
}

export function periodeLabel(kode: string, periods?: Pick<PeriodeHarga, 'kode' | 'nama'>[]): string {
  return periods?.find((p) => p.kode === kode)?.nama ?? PERIODE_LABEL[kode] ?? kode
}

export function tambahHari(tgl: string, hari: number): string {
  const d = new Date(tgl)
  d.setDate(d.getDate() + hari)
  return d.toISOString().slice(0, 10)
}

export const PERIODE_LABEL: Record<string, string> = {
  early_bird: 'Early Bird',
  reguler: 'Reguler',
  last_minute: 'Last Minute',
}

export const STATUS_LABEL: Record<string, string> = {
  daftar: 'Daftar',
  dp: 'DP',
  cicil: 'Cicil',
  lunas: 'Lunas',
  batal: 'Batal',
  menunggak: 'Menunggak',
}

export const STATUS_COLOR: Record<string, string> = {
  daftar: 'bg-gray-100 text-gray-700',
  dp: 'bg-yellow-100 text-yellow-700',
  cicil: 'bg-blue-100 text-blue-700',
  lunas: 'bg-green-100 text-green-700',
  batal: 'bg-red-100 text-red-700',
  menunggak: 'bg-orange-100 text-orange-700',
}
