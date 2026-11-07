'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  remove: (id: string) => void
  reset: (id: string) => void
}

export type TurnstileHandle = {
  reset: () => void
  getToken: () => string | null
  waitForToken: (timeoutMs?: number) => Promise<string | null>
}

const noop = () => {}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export const Turnstile = forwardRef<TurnstileHandle, { onToken?: (token: string | null) => void; className?: string }>(
  function Turnstile({ onToken, className }, ref) {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    const container = useRef<HTMLDivElement>(null)
    const widget = useRef<string | null>(null)
    const token = useRef<string | null>(null)
    const waiters = useRef<Array<(value: string | null) => void>>([])
    const callback = useRef(onToken ?? noop)
    callback.current = onToken ?? noop

    const settle = useCallback((value: string | null) => {
      token.current = value
      callback.current(value)
      const pending = waiters.current
      waiters.current = []
      pending.forEach((resolve) => resolve(value))
    }, [])

    const resetWidget = useCallback(() => {
      settle(null)
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current)
    }, [settle])

    const waitForToken = useCallback((timeoutMs = 15000) => {
      if (!siteKey) return Promise.resolve('')
      if (token.current) return Promise.resolve(token.current)
      container.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      return new Promise<string | null>((resolve) => {
        let timer = 0
        const waiter = (value: string | null) => {
          window.clearTimeout(timer)
          resolve(value)
        }
        timer = window.setTimeout(() => {
          waiters.current = waiters.current.filter((item) => item !== waiter)
          resolve(null)
        }, timeoutMs)
        waiters.current.push(waiter)
      })
    }, [siteKey])

    const getToken = useCallback(() => token.current, [])

    useImperativeHandle(ref, () => ({ getToken, reset: resetWidget, waitForToken }), [getToken, resetWidget, waitForToken])

    useEffect(() => {
      if (!siteKey) return
      const timer = window.setInterval(() => {
        if (!window.turnstile || !container.current || widget.current) return
        try {
          widget.current = window.turnstile.render(container.current, {
            sitekey: siteKey,
            callback: (value: string) => settle(value),
            'expired-callback': resetWidget,
            'error-callback': () => settle(null),
          })
        } catch {
          settle(null)
        }
        window.clearInterval(timer)
      }, 200)

      return () => {
        window.clearInterval(timer)
        if (widget.current && window.turnstile) window.turnstile.remove(widget.current)
        widget.current = null
      }
    }, [resetWidget, settle, siteKey])

    if (!siteKey) return null

    return <div ref={container} className={className} />
  },
)
