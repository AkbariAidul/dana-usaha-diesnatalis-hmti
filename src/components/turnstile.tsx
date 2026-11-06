'use client'

import Script from 'next/script'
import { useEffect, useRef } from 'react'

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export function Turnstile({ onToken, className }: { onToken: (token: string | null) => void; className?: string }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const container = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const callback = useRef(onToken)
  callback.current = onToken

  useEffect(() => {
    if (!siteKey) return
    const timer = window.setInterval(() => {
      if (!window.turnstile || !container.current || widget.current) return
      widget.current = window.turnstile.render(container.current, {
        sitekey: siteKey,
        callback: (token: string) => callback.current(token),
        'expired-callback': () => callback.current(null),
        'error-callback': () => callback.current(null),
      })
    }, 200)

    return () => {
      window.clearInterval(timer)
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current)
      widget.current = null
    }
  }, [siteKey])

  if (!siteKey) return null

  return (
    <div className={className}>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="lazyOnload" />
      <div ref={container} />
    </div>
  )
}
