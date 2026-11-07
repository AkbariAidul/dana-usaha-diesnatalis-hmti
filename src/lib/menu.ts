import {
  LayoutDashboard,
  Users,
  Ticket,
  Briefcase,
  ShoppingCart,
  QrCode,
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
    key: 'umum',
    label: 'UMUM',
    icon: Briefcase,
    children: [
      { label: 'Laporan', href: '/dankelola/laporan' },
      { label: 'Monitoring', href: '/dankelola/monitoring' },
      { label: 'Pengaturan QRIS', href: '/dankelola/pengaturan/qris' },
      { label: 'Kelola User', href: '/dankelola/pengaturan/users' },
      { label: 'Audit Log', href: '/dankelola/audit' },
    ],
  },
]
