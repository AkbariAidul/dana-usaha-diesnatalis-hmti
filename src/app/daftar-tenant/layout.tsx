import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Daftar Tenant In4Days XI',
  description: 'Buka booth usaha kamu di In4Days XI. Pilih kategori sewa, isi data usaha, dan daftar secara online.',
  alternates: { canonical: '/daftar-tenant' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
