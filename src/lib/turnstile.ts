import { requestIp, type HeaderReader } from '@/lib/request-meta'

export async function verifyTurnstile(token: unknown, headers: HeaderReader) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return process.env.NODE_ENV !== 'production'
  if (!token || typeof token !== 'string') return false

  try {
    const form = new URLSearchParams({ secret, response: token })
    const ip = requestIp(headers)
    if (ip) form.set('remoteip', ip)

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json() as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}
