import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pre-Order Merchandise In4Days XI',
  description: 'Pre-order merchandise resmi In4Days XI: pilih varian, ukuran, dan warna favoritmu.',
  alternates: { canonical: '/po-merchandise' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
