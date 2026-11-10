import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Form Pendaftaran Tenant',
  description: 'Lengkapi data usaha dan unggah bukti pembayaran untuk mendaftar sebagai tenant In4Days XI.',
  alternates: { canonical: '/daftar-tenant/form' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
