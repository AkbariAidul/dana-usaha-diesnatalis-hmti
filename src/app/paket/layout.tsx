import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Paket Combo In4Days XI',
  description: 'Gabungkan tiket dan merchandise In4Days XI dalam satu paket combo dengan harga lebih hemat.',
  alternates: { canonical: '/paket' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
