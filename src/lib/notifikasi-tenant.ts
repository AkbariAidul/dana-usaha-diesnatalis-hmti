import { signRef } from './link-token'
import { formatRupiah } from './utils'
import { baseUrl, kirimWhatsApp } from './notifikasi-tiket'
import { labelJenisUsaha } from './tenant'

type AddonNotif = {
  nama: string
  qty: number
  subtotal: number
}

export type TenantNotif = {
  kode_pendaftaran?: string | null
  kode_stand?: string | null
  nama_usaha: string
  kontak: string
  harga_akhir: number
  sudah_dibayar?: number | null
  status?: string | null
  pembayaran_tipe?: string | null
  nominal_bayar?: number | null
  jumlah_tenant?: number | null
  jenis_usaha_qty?: { fnb?: number; nonFnb?: number } | null
  addon?: AddonNotif[] | null
  catatan_admin?: string | null
}

const PENUTUP = 'Hormat Kami,\nPanitia Danus In4Days XI'

function kodeTenant(tenant: TenantNotif) {
  return String(tenant.kode_stand || tenant.kode_pendaftaran || '')
}

export function linkTenant(request: Request, kode: string) {
  return `${baseUrl(request)}/lacak/${encodeURIComponent(kode)}?t=${encodeURIComponent(signRef('tenant', kode))}`
}

function detailTenant(tenant: TenantNotif, link: string) {
  const total = Number(tenant.harga_akhir ?? 0)
  const sudah = Number(tenant.sudah_dibayar ?? 0)
  const sisa = Math.max(0, total - sudah)
  const addon = tenant.addon ?? []
  const lines: string[] = [
    `Kode: ${kodeTenant(tenant)}`,
    `Usaha: ${tenant.nama_usaha}`,
    `Jumlah tenant: ${Number(tenant.jumlah_tenant ?? 1)}${tenant.jenis_usaha_qty ? ` (${labelJenisUsaha(null, tenant.jenis_usaha_qty)})` : ''}`,
    ...(addon.length > 0
      ? ['', 'Rincian item:', ...addon.map((item) => `  - ${item.nama} x${item.qty} = ${formatRupiah(item.subtotal)}`)]
      : []),
    '',
    `Total tagihan: ${formatRupiah(total)}`,
    tenant.nominal_bayar ? `Pembayaran ini: ${formatRupiah(Number(tenant.nominal_bayar))}` : null,
    sudah > 0 ? `Sudah dibayar: ${formatRupiah(sudah)}` : null,
    sisa > 0 ? `Sisa: ${formatRupiah(sisa)}` : null,
    '',
    `Riwayat & QR venue: ${link}`,
  ].filter((v): v is string => v !== null)
  return lines.join('\n')
}

export function pesanTenantMenungguVerifikasi(request: Request, tenant: TenantNotif) {
  const link = linkTenant(request, kodeTenant(tenant))
  return [
    `Halo ${tenant.nama_usaha}, bukti pembayaran tenant kamu sudah kami terima.`,
    '',
    detailTenant(tenant, link),
    'Status: Menunggu verifikasi admin.',
    '',
    'QR masuk venue aktif setelah total pembayaran tervalidasi mencapai 80%.',
    'Setelah itu, tombol gabung grup WhatsApp tenant juga muncul di halaman riwayat.',
    '',
    PENUTUP,
  ].join('\n')
}

export function pesanTenantTerverifikasi(request: Request, tenant: TenantNotif) {
  const link = linkTenant(request, kodeTenant(tenant))
  const total = Number(tenant.harga_akhir ?? 0)
  const sudah = Number(tenant.sudah_dibayar ?? 0)
  const lunas = sudah >= total && total > 0
  return [
    `Halo ${tenant.nama_usaha}, pembayaran tenant kamu sudah diverifikasi.`,
    '',
    detailTenant(tenant, link),
    lunas
      ? 'Status: LUNAS. QR masuk venue sudah bisa diakses dari link riwayat tenant.'
      : `Status: pembayaran diterima. Sisa ${formatRupiah(Math.max(0, total - sudah))}. Silakan lanjutkan pembayaran berikutnya sampai lunas.`,
    total > 0 && sudah >= total * 0.8
      ? 'Tombol gabung grup WhatsApp tenant sudah aktif di halaman riwayat.'
      : 'Tombol gabung grup WhatsApp tenant muncul di halaman riwayat setelah pembayaran mencapai 80%.',
    '',
    PENUTUP,
  ].join('\n')
}

export function pesanTenantDitolak(request: Request, tenant: TenantNotif) {
  const link = linkTenant(request, kodeTenant(tenant))
  return [
    `Halo ${tenant.nama_usaha}, bukti pembayaran tenant kamu belum dapat diterima.`,
    '',
    detailTenant(tenant, link),
    'Status: Ditolak.',
    tenant.catatan_admin ? `Catatan admin: ${tenant.catatan_admin}` : null,
    'Silakan unggah ulang bukti pembayaran yang valid melalui link riwayat tenant.',
    '',
    PENUTUP,
  ].filter((v): v is string => v !== null).join('\n')
}

export function pesanTenantCheckin(request: Request, tenant: TenantNotif) {
  const link = linkTenant(request, kodeTenant(tenant))
  return [
    `Halo ${tenant.nama_usaha}, tenant kamu sudah tercatat masuk ke area venue.`,
    '',
    detailTenant(tenant, link),
    'Status: Sudah check-in venue.',
    '',
    'Terima kasih telah berpartisipasi di Danus In4Days XI.',
    '',
    PENUTUP,
  ].join('\n')
}

export async function kirimNotifTenantMenungguVerifikasi(request: Request, tenant: TenantNotif) {
  return kirimWhatsApp(tenant.kontak, pesanTenantMenungguVerifikasi(request, tenant))
}

export async function kirimNotifTenantTerverifikasi(request: Request, tenant: TenantNotif) {
  return kirimWhatsApp(tenant.kontak, pesanTenantTerverifikasi(request, tenant))
}

export async function kirimNotifTenantDitolak(request: Request, tenant: TenantNotif) {
  return kirimWhatsApp(tenant.kontak, pesanTenantDitolak(request, tenant))
}

export async function kirimNotifTenantCheckin(request: Request, tenant: TenantNotif) {
  return kirimWhatsApp(tenant.kontak, pesanTenantCheckin(request, tenant))
}
