'use client'

import Script from 'next/script'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  remove: (id: string) => void
  reset: (id: string) => void
}

export type TurnstileHandle = { reset: () => void }

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export const Turnstile = forwardRef<TurnstileHandle, { onToken: (token: string | null) => void; className?: string }>(
  function Turnstile({ onToken, className }, ref) {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    const container = useRef<HTMLDivElement>(null)
    const widget = useRef<string | null>(null)
    const callback = useRef(onToken)
    callback.current = onToken

    const resetWidget = useCallback(() => {
      callback.current(null)
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current)
    }, [])

    useImperativeHandle(ref, () => ({ reset: resetWidget }), [resetWidget])

    useEffect(() => {
      if (!siteKey) return
      const timer = window.setInterval(() => {
        if (!window.turnstile || !container.current || widget.current) return
        try {
          widget.current = window.turnstile.render(container.current, {
            sitekey: siteKey,
            callback: (token: string) => callback.current(token),
            'expired-callback': resetWidget,
            'error-callback': () => callback.current(null),
          })
        } catch {
          callback.current(null)
        }
        window.clearInterval(timer)
      }, 200)

      return () => {
        window.clearInterval(timer)
        if (widget.current && window.turnstile) window.turnstile.remove(widget.current)
        widget.current = null
      }
    }, [resetWidget, siteKey])

    if (!siteKey) return null

    return (
      <div className={className}>
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
        <div ref={container} />
      </div>
    )
  },
)
