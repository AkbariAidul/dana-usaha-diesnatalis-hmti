'use client'
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="id">
      <body>
        <main style={{ minHeight: '100vh', display: 'grid', placeContent: 'center', gap: 12, padding: 24, fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Terjadi kesalahan</h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>Silakan coba lagi. Jika masih berlanjut, hubungi panitia.</p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ marginTop: 8, padding: '8px 16px', borderRadius: 10, border: 0, background: '#6d28d9', color: '#fff', cursor: 'pointer' }}
          >
            Coba lagi
          </button>
        </main>
      </body>
    </html>
  )
}
