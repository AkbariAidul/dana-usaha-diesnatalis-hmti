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
  metode_cicilan?: string | null
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
  const pengurus = po.tipe_pemesan === 'Pengurus Himpunan'
  const metode = po.metode_cicilan || po.pembayaran_metode
  const lines: string[] = [
    `Kode PO: ${po.no_po}`,
    `Nama: ${po.nama_pemesan}`,
    `Kategori: ${po.tipe_pemesan}`,
    pengurus && metode ? `Metode: ${metode}` : null,
    pengurus && po.pembayaran_tipe ? `Tipe: ${po.pembayaran_tipe}` : null,
    '',
    'Detail Pesanan:',
    detailItem(po.items) || '  (lihat di riwayat)',
    '',
    `Total: ${formatRupiah(total)}`,
    po.nominal_cicilan
      ? `${po.pembayaran_tipe === 'nyicil' ? 'Cicilan ini' : 'Pembayaran'}: ${formatRupiah(Number(po.nominal_cicilan))}`
      : null,
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

function waktuWib(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d)
}

export async function kirimNotifPoDiambil(request: Request, po: PoNotif & { picked_up_at?: string | null }) {
  const link = linkPo(request, po.no_po)
  const message = [
    `Halo ${po.nama_pemesan}, merchandise PO kamu sudah diambil.`,
    '',
    detailPo(po, link),
    `Status: Sudah diambil${po.picked_up_at ? ` pada ${waktuWib(po.picked_up_at)} WIB` : ''}.`,
    '',
    'Terima kasih telah melakukan pre-order merchandise Danus In4Days XI.',
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
      : po.pembayaran_tipe === 'nyicil'
        ? `Status: cicilan diterima. Nominal cicilan ini: ${po.nominal_cicilan ? formatRupiah(Number(po.nominal_cicilan)) : '-'}. Sisa pembayaran masih ada, silakan lakukan cicilan berikutnya.`
        : `Status: pembayaran diterima. Nominal: ${po.nominal_cicilan ? formatRupiah(Number(po.nominal_cicilan)) : '-'}. Sisa pembayaran masih ada.`,
    '',
    PENUTUP,
  ].join('\n')
  return kirimWhatsApp(po.kontak, message)
}
