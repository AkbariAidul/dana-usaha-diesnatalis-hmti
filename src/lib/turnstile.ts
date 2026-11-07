import { requestIp, type HeaderReader } from '@/lib/request-meta'

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: 'config' | 'missing' | 'invalid' }

export async function verifyTurnstile(token: unknown, headers: HeaderReader): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    if (process.env.NODE_ENV !== 'production') return { ok: true }
    console.error('[turnstile] TURNSTILE_SECRET_KEY belum diset di production')
    return { ok: false, reason: 'config' }
  }
  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing' }

  try {
    const form = new URLSearchParams({ secret, response: token })
    const ip = requestIp(headers)
    if (ip) form.set('remoteip', ip)

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json() as {
      success?: boolean
      hostname?: string
      'error-codes'?: string[]
    }
    if (data.success === true) return { ok: true }
    console.warn('[turnstile] verifikasi gagal', {
      codes: data['error-codes'],
      hostname: data.hostname,
    })
    return { ok: false, reason: 'invalid' }
  } catch (err) {
    console.error('[turnstile] siteverify error', err)
    return { ok: false, reason: 'invalid' }
  }
}

export function turnstileFailure(reason: 'config' | 'missing' | 'invalid') {
  if (reason === 'config') {
    return { error: 'Verifikasi keamanan belum siap. Hubungi admin.', status: 503 }
  }
  if (reason === 'missing') {
    return { error: 'Selesaikan verifikasi keamanan terlebih dahulu', status: 400 }
  }
  return { error: 'Verifikasi keamanan gagal atau kedaluwarsa, coba lagi', status: 400 }
}
