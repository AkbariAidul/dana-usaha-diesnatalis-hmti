'use client'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Terjadi kesalahan</p>
        <p className="mt-2 text-sm text-slate-500">{error.message || 'Silakan coba lagi.'}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Coba lagi
        </button>
      </div>
    </div>
  )
}
