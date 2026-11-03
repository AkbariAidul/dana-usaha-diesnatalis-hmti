import { signRef } from './link-token'
import { formatRupiah } from './utils'
import { baseUrl, kirimWhatsApp } from './notifikasi-tiket'

type ItemDetail = {
  nama_produk: string
  ukuran: string | null
  qty: number
  harga_satuan: number
  subtotal: number
}

type PoNotif = {
  status: string
  no_po: string
  nama_pemesan: string
  kontak: string
  tipe_pemesan: string
  total: number
  sudah_dibayar?: number | null
  pembayaran_metode?: string | null
  pembayaran_tipe?: string | null
  items?: ItemDetail[]
  nominal_cicilan?: number | null
}

const PENUTUP = 'Hormat Kami,\nPanitia Danus In4Days XI'

function linkPo(request: Request, kode: string) {
  return `${baseUrl(request)}/lacak/${encodeURIComponent(kode)}?t=${encodeURIComponent(signRef('po', kode))}`
}

function detailItem(items?: ItemDetail[]) {
  if (!items || items.length === 0) return ''
  return items.map((item) => {
    const ukuran = item.ukuran ? ` (${item.ukuran})` : ''
    return `  - ${item.nama_produk}${ukuran} x${item.qty} @ ${formatRupiah(item.harga_satuan)} = ${formatRupiah(item.subtotal)}`
  }).join('\n')
}

function detailPo(po: PoNotif, link: string) {
  const dibayar = Number(po.sudah_dibayar ?? 0)
  const total = Number(po.total ?? 0)
  const sisa = Math.max(0, total - dibayar)
  const lines: string[] = [
    `Kode PO: ${po.no_po}`,
    `Nama: ${po.nama_pemesan}`,
    `Kategori: ${po.tipe_pemesan}`,
    po.pembayaran_metode ? `Metode: ${po.pembayaran_metode}` : null,
    po.pembayaran_tipe ? `Tipe: ${po.pembayaran_tipe}` : null,
    '',
    'Detail Pesanan:',
    detailItem(po.items) || '  (lihat di riwayat)',
    '',
    `Total: ${formatRupiah(total)}`,
    po.nominal_cicilan ? `Cicilan ini: ${formatRupiah(Number(po.nominal_cicilan))}` : null,
    dibayar > 0 ? `Sudah dibayar: ${formatRupiah(dibayar)}` : null,
    sisa > 0 ? `Sisa: ${formatRupiah(sisa)}` : null,
    '',
    `Riwayat & QR pengambilan: ${link}`,
  ].filter((v): v is string => v !== null)
  return lines.join('\n')
}

export async function kirimNotifPoMenungguVerifikasi(request: Request, po: PoNotif) {
  const link = linkPo(request, po.no_po)
  const message = [
    `Halo ${po.nama_pemesan}, bukti pembayaran PO kamu sudah kami terima.`,
    '',
    detailPo(po, link),
    'Status: Menunggu verifikasi admin.',
    '',
    'QR pengambilan merchandise aktif setelah pembayaran dinyatakan lunas.',
    '',
    PENUTUP,
  ].join('\n')
  return kirimWhatsApp(po.kontak, message)
}

export async function kirimNotifPoTerverifikasi(request: Request, po: PoNotif) {
  const link = linkPo(request, po.no_po)
  const lunas = po.status === 'lunas'
  const message = [
    `Halo ${po.nama_pemesan}, pembayaran PO kamu sudah diverifikasi.`,
    '',
    detailPo(po, link),
    lunas
      ? 'Status: LUNAS. QR pengambilan merchandise sudah aktif di link riwayat PO.'
      : `Status: DP/cicilan diterima. Nominal cicilan ini: ${po.nominal_cicilan ? formatRupiah(Number(po.nominal_cicilan)) : '-'}. Sisa pembayaran masih ada, silakan lakukan cicilan berikutnya sesuai kesepakatan.`,
    '',
    PENUTUP,
  ].join('\n')
  return kirimWhatsApp(po.kontak, message)
}
