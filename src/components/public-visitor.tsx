'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

function getVisitorId() {
  try {
    const existing = localStorage.getItem('dana_usaha_visitor')
    if (existing) return existing
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem('dana_usaha_visitor', id)
    return id
  } catch {
    return null
  }
}

export function PublicVisitorTracker() {
  const pathname = usePathname()
  const lastPath = useRef('')

  useEffect(() => {
    if (!pathname || pathname.startsWith('/dankelola') || pathname.startsWith('/api')) return
    if (lastPath.current === pathname) return
    lastPath.current = pathname

    fetch('/api/public/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: pathname,
        referrer: document.referrer || null,
        visitor_id: getVisitorId(),
      }),
      keepalive: true,
    }).catch(() => {})
  }, [pathname])

  return null
}
