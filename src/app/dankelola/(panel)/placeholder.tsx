import Link from 'next/link'

export default function PlaceholderPage({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{desc}</p>
      </div>
      <div className="rounded-2xl border border-slate-200/70 bg-white p-10 text-center shadow-sm shadow-slate-200/40">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50">
          <span className="text-lg text-slate-400">∅</span>
        </div>
        <p className="text-sm font-medium text-slate-600">Halaman ini sedang disiapkan</p>
        <p className="mt-1 text-sm text-slate-400">Fitur akan tersedia pada pengembangan selanjutnya.</p>
        <Link href="/dankelola" className="mt-4 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700">
          Kembali ke Ringkasan
        </Link>
      </div>
    </div>
  )
}
