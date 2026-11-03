import { signRef } from './link-token'
import { formatRupiah } from './utils'
import { baseUrl, kirimWhatsApp } from './notifikasi-tiket'

type PoNotif = {
  status: string
  no_po: string
  nama_pemesan: string
  kontak: string
  total: number
  sudah_dibayar?: number | null
  pembayaran_metode?: string | null
  pembayaran_tipe?: string | null
}

const PENUTUP = 'Hormat Kami,\nPanitia Danus In4Days XI'

function linkPo(request: Request, kode: string) {
  return `${baseUrl(request)}/lacak/${encodeURIComponent(kode)}?t=${encodeURIComponent(signRef('po', kode))}`
}

function detailPo(po: PoNotif, link: string) {
  const dibayar = Number(po.sudah_dibayar ?? 0)
  const total = Number(po.total ?? 0)
  return [
    `Kode PO: ${po.no_po}`,
    `Nama: ${po.nama_pemesan}`,
    po.pembayaran_metode && `Metode: ${po.pembayaran_metode}`,
    po.pembayaran_tipe && `Tipe: ${po.pembayaran_tipe}`,
    `Total: ${formatRupiah(total)}`,
    dibayar > 0 && `Sudah dibayar: ${formatRupiah(dibayar)}`,
    dibayar > 0 && `Sisa: ${formatRupiah(Math.max(0, total - dibayar))}`,
    '',
    `Riwayat & QR pengambilan: ${link}`,
  ].filter(Boolean).join('\n')
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
      ? 'Status: Lunas. QR pengambilan merchandise sudah aktif di link riwayat PO.'
      : 'Status: DP/cicilan diterima. Silakan lanjutkan pelunasan sesuai kesepakatan.',
    '',
    PENUTUP,
  ].join('\n')
  return kirimWhatsApp(po.kontak, message)
}
