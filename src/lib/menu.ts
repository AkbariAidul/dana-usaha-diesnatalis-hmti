import {
  LayoutDashboard,
  Users,
  CreditCard,
  Package,
  Ticket,
  FileText,
  Settings,
  ScrollText,
  Briefcase,
  Boxes,
  ShoppingCart,
  ClipboardList,
  UserCheck,
  Gift,
  Wallet,
  CheckSquare,
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
    key: 'tenant',
    label: 'TENANT',
    icon: Users,
    children: [
      { label: 'Data Tenant', href: '/dankelola/tenants' },
      { label: 'Pembayaran', href: '/dankelola/tenants/pembayaran' },
      { label: 'Paket & Harga', href: '/dankelola/tenants/harga' },
      { label: 'Sewa Vendor', href: '/dankelola/tenants/peralatan' },
      { label: 'Kuota & Denah', href: '/dankelola/tenants/kuota' },
    ],
  },
  {
    key: 'merchandise',
    label: 'MERCHANDISE',
    icon: ShoppingCart,
    children: [
      { label: 'Produk & Harga', href: '/dankelola/merchandise/produk' },
      { label: 'Pre-Order', href: '/dankelola/merchandise/preorder' },
      { label: 'Produksi & Stok', href: '/dankelola/merchandise/stok' },
      { label: 'Penjualan Hari H', href: '/dankelola/merchandise/kasir' },
    ],
  },
  {
    key: 'ticket',
    label: 'TICKET',
    icon: Ticket,
    children: [
      { label: 'Tahap & Harga', href: '/dankelola/ticket/tahap' },
      { label: 'Penjualan', href: '/dankelola/ticket/penjualan' },
      { label: 'Check-in', href: '/dankelola/ticket/checkin' },
      { label: 'Promo & Penjual', href: '/dankelola/ticket/promo' },
    ],
  },
  {
    key: 'umum',
    label: 'UMUM',
    icon: Briefcase,
    children: [
      { label: 'Keuangan', href: '/dankelola/keuangan' },
      { label: 'Tugas', href: '/dankelola/tugas' },
      { label: 'Laporan', href: '/dankelola/laporan' },
      { label: 'Pengaturan Acara', href: '/dankelola/acara' },
      { label: 'Pengaturan QRIS', href: '/dankelola/pengaturan/qris' },
      { label: 'Audit Log', href: '/dankelola/audit' },
    ],
  },
]
