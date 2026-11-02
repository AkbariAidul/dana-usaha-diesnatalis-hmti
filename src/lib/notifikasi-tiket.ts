import { signRef } from './link-token'
import { formatDate, formatRupiah } from './utils'

type PesananNotif = {
  id: string
  no_pesanan: string
  nama_pembeli: string
  kontak: string
  jumlah: number
  total: number
  tiket_tipe_id?: string | null
}

type AcaraNotif = {
  nama?: string | null
  tanggal_acara?: string | null
}

function nomorFonnte(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('8')) return `62${digits}`
  return digits
}

function baseUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
  if (configured) return configured.replace(/\/$/, '')
  const url = new URL(request.url)
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '') || 'https'
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host
  return `${proto}://${host}`
}

function linkTiket(request: Request, kode: string) {
  return `${baseUrl(request)}/lacak/${encodeURIComponent(kode)}?t=${encodeURIComponent(signRef('tiket', kode))}`
}

function detailPesanan(pesanan: PesananNotif, tipeNama: string, link: string) {
  return [
    `Kode pesanan: ${pesanan.no_pesanan}`,
    `Nama: ${pesanan.nama_pembeli}`,
    `Tipe tiket: ${tipeNama}`,
    `Jumlah: ${pesanan.jumlah} tiket`,
    `Total: ${formatRupiah(Number(pesanan.total))}`,
    '',
    `Riwayat & QR tiket: ${link}`,
  ].join('\n')
}

export async function kirimWhatsApp(target: string, message: string) {
  const token = process.env.FONNTE_TOKEN
  if (!token) {
    console.warn('FONNTE_TOKEN belum diset, notifikasi WhatsApp dilewati')
    return false
  }

  const nomor = nomorFonnte(target)
  if (!nomor) return false

  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        target: nomor,
        message,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    const data = (await res.json().catch(() => ({}))) as { status?: boolean; reason?: string }
    if (!res.ok || data.status === false) {
      console.error('Fonnte gagal mengirim:', data.reason || res.status)
      return false
    }
    return true
  } catch (err) {
    console.error('Fonnte gagal mengirim:', err)
    return false
  }
}

export async function kirimNotifMenungguVerifikasi(
  request: Request,
  pesanan: PesananNotif,
  tipeNama: string
) {
  const link = linkTiket(request, pesanan.no_pesanan)
  const message = [
    `Halo ${pesanan.nama_pembeli}, bukti pembayaran tiket kamu sudah kami terima.`,
    '',
    detailPesanan(pesanan, tipeNama, link),
    'Status: Menunggu verifikasi admin.',
    '',
    'QR tiket akan aktif setelah pembayaran diverifikasi. Simpan link di atas untuk mengecek status terbaru.',
  ].join('\n')
  return kirimWhatsApp(pesanan.kontak, message)
}

export async function kirimNotifTerverifikasi(
  request: Request,
  pesanan: PesananNotif,
  tipeNama: string
) {
  const link = linkTiket(request, pesanan.no_pesanan)
  const message = [
    `Halo ${pesanan.nama_pembeli}, pembayaran tiket kamu sudah diverifikasi.`,
    '',
    detailPesanan(pesanan, tipeNama, link),
    'Status: Lunas / terverifikasi.',
    '',
    'QR tiket sudah aktif di link riwayat tiket. Tunjukkan QR tersebut ke petugas saat check-in hari H.',
  ].join('\n')
  return kirimWhatsApp(pesanan.kontak, message)
}

export async function kirimNotifReminder(
  request: Request,
  pesanan: PesananNotif,
  tipeNama: string,
  hari: number,
  acara: AcaraNotif
) {
  const link = linkTiket(request, pesanan.no_pesanan)
  const namaAcara = acara.nama || 'acara'
  const tanggal = acara.tanggal_acara ? formatDate(acara.tanggal_acara) : ''
  const message = [
    `Halo ${pesanan.nama_pembeli}, pengingat ${namaAcara} tinggal H-${hari}${tanggal ? ` (${tanggal})` : ''}.`,
    '',
    detailPesanan(pesanan, tipeNama, link),
    'Jangan lupa simpan QR tiket dan tunjukkan ke petugas saat check-in.',
  ].join('\n')
  return kirimWhatsApp(pesanan.kontak, message)
}
