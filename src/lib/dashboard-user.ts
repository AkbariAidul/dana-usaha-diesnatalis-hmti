'use client'

import { useEffect, useState } from 'react'
import type { DashboardUser } from './auth'

export function useDashboardUser() {
  const [user, setUser] = useState<DashboardUser | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<DashboardUser>) : null))
      .then((data) => {
        if (active) setUser(data)
      })
      .catch(() => {
        if (active) setUser(null)
      })
    return () => {
      active = false
    }
  }, [])

  return user
}

export function useIsViewer() {
  return useDashboardUser()?.role === 'viewer'
}
