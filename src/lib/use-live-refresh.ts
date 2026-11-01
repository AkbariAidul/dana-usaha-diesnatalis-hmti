'use client'

import { useEffect, useRef } from 'react'

export function useLiveRefresh(refresh: () => void | Promise<void>, ms = 5000, enabled = true) {
  const ref = useRef(refresh)

  useEffect(() => {
    ref.current = refresh
  })

  useEffect(() => {
    if (!enabled) return
    let busy = false
    const tick = async () => {
      if (busy || document.visibilityState !== 'visible') return
      busy = true
      try {
        await ref.current()
      } catch (err) {
        console.error('Live refresh gagal:', err)
      } finally {
        busy = false
      }
    }
    const id = window.setInterval(tick, ms)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick()
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [ms, enabled])
}
