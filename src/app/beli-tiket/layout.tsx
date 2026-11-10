import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Beli Tiket In4Days XI',
  description: 'Beli tiket In4Days XI secara online, bayar via QRIS, dan dapatkan QR tiket langsung setelah verifikasi.',
  alternates: { canonical: '/beli-tiket' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
