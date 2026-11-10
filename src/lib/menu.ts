import {
  LayoutDashboard,
  Users,
  Ticket,
  Briefcase,
  ShoppingCart,
  QrCode,
  FileText,
  Package,
  type LucideIcon,
} from 'lucide-react'

export type MenuChild = {
  label: string
  href: string
}

export type MenuGroup = {
  key: string
  label: string
  icon: LucideIcon
  href?: string
  children?: MenuChild[]
}

export const menuConfig: MenuGroup[] = [
  {
    key: 'ringkasan',
    label: 'Ringkasan',
    icon: LayoutDashboard,
    href: '/dankelola',
  },
  {
    key: 'scan',
    label: 'Scan QR',
    icon: QrCode,
    href: '/dankelola/scan',
  },
  {
    key: 'tenant',
    label: 'TENANT',
    icon: Users,
    children: [
      { label: 'Data Tenant', href: '/dankelola/tenants' },
      { label: 'Paket & Harga', href: '/dankelola/tenants/harga' },
      { label: 'Sewa Vendor', href: '/dankelola/tenants/peralatan' },
    ],
  },
  {
    key: 'merchandise',
    label: 'MERCHANDISE',
    icon: ShoppingCart,
    children: [
      { label: 'Produk & Harga', href: '/dankelola/merchandise/produk' },
      { label: 'Data Pengurus', href: '/dankelola/merchandise/pengurus' },
      { label: 'Data Preorder', href: '/dankelola/merchandise/preorder' },
      { label: 'Produksi & Stok', href: '/dankelola/merchandise/stok' },
      { label: 'Kasir Hari H', href: '/dankelola/merchandise/kasir' },
    ],
  },
  {
    key: 'ticket',
    label: 'TICKET',
    icon: Ticket,
    children: [
      { label: 'Tipe & Harga', href: '/dankelola/ticket/tahap' },
      { label: 'Penjualan', href: '/dankelola/ticket/penjualan' },
      { label: 'Check-in', href: '/dankelola/ticket/checkin' },
    ],
  },
  {
    key: 'bundle',
    label: 'BUNDLE',
    icon: Package,
    children: [
      { label: 'Paket Combo', href: '/dankelola/paket' },
      { label: 'Pesanan Paket', href: '/dankelola/paket/pesanan' },
    ],
  },
  {
    key: 'umum',
    label: 'UMUM',
    icon: Briefcase,
    children: [
      { label: 'Laporan', href: '/dankelola/laporan' },
      { label: 'Monitoring', href: '/dankelola/monitoring' },
      { label: 'Pengaturan QRIS', href: '/dankelola/pengaturan/qris' },
      { label: 'Pengaturan Tenant', href: '/dankelola/pengaturan/tenant' },
      { label: 'Kelola User', href: '/dankelola/pengaturan/users' },
      { label: 'Notifikasi WA', href: '/dankelola/notifikasi' },
      { label: 'Audit Log', href: '/dankelola/audit' },
    ],
  },
  // Dedicated top-level menu for viewer role (replaces Umum → Laporan)
  {
    key: 'laporan-pelihat',
    label: 'LAPORAN',
    icon: FileText,
    href: '/dankelola/laporan',
  },
]

/** Return filtered menu groups for a given role. Viewer only sees Ringkasan, Scan, and Laporan. */
export function getMenuForRole(role: string): MenuGroup[] {
  if (role === 'viewer') {
    const allowed = new Set(['ringkasan', 'scan', 'tenant', 'merchandise', 'ticket', 'laporan-pelihat'])
    return menuConfig.filter((g) => allowed.has(g.key))
  }
  // Menu LAPORAN khusus viewer; pengelola sudah punya Laporan di dalam grup UMUM.
  return menuConfig.filter((g) => g.key !== 'laporan-pelihat')
}
