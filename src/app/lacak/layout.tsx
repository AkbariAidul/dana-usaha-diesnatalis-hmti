import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Lacak Pesanan',
  description: 'Cek status pesanan tiket, merchandise, paket combo, dan pendaftaran tenant In4Days XI.',
  alternates: { canonical: '/lacak' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
