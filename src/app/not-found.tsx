import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Halaman tidak ditemukan</p>
        <p className="mt-2 text-sm text-slate-500">Alamat yang kamu buka tidak tersedia atau sudah dipindahkan.</p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Kembali ke beranda
        </Link>
      </div>
    </div>
  )
}
