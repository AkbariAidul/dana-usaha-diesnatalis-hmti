'use client'

import { useEffect, useState } from 'react'
import type { DashboardUser } from './auth'

export function parseDashboardUser(raw: string): DashboardUser | null {
  try {
    return JSON.parse(decodeURIComponent(raw))
  } catch {
    try {
      return JSON.parse(decodeURIComponent(decodeURIComponent(raw)))
    } catch {
      return null
    }
  }
}

export function useDashboardUser() {
  const [user, setUser] = useState<DashboardUser | null>(null)

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )dashboard_user=([^;]+)/)
    if (match) setUser(parseDashboardUser(match[1]))
  }, [])

  return user
}

export function useIsViewer() {
  return useDashboardUser()?.role === 'viewer'
}
