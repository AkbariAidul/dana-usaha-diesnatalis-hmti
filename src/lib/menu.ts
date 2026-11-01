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
      { label: 'Verifikasi Tenant', href: '/dankelola/tenants/verifikasi' },
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
      { label: 'Data Pengurus', href: '/dankelola/merchandise/pengurus' },
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
      { label: 'Tipe & Harga', href: '/dankelola/ticket/tahap' },
      { label: 'Periode Harga', href: '/dankelola/ticket/periode' },
      { label: 'Penjualan', href: '/dankelola/ticket/penjualan' },
      { label: 'Verifikasi Tiket', href: '/dankelola/ticket/verifikasi' },
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
