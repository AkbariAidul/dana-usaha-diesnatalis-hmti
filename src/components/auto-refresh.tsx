'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function AutoRefresh({ ms = 5000 }: { ms?: number }) {
  const router = useRouter()

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, ms)
    return () => window.clearInterval(id)
  }, [router, ms])

  return null
}
