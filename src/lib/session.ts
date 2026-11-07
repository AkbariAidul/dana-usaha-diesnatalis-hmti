import type { DashboardRole } from './auth'

export type SessionUser = {
  name: string
  role: DashboardRole
}

type SessionPayload = {
  n: string
  r: DashboardRole
  e: number
}

export const SESSION_COOKIE = 'dashboard_session'
export const SESSION_MAX_AGE = 86400

function secret() {
  if (process.env.DASHBOARD_SESSION_SECRET) return process.env.DASHBOARD_SESSION_SECRET
  return process.env.NODE_ENV !== 'production' ? 'dev-session-secret' : ''
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmacKey() {
  const value = secret()
  if (!value) throw new Error('DASHBOARD_SESSION_SECRET belum diset')
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(value),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function signSession(user: SessionUser, maxAge = SESSION_MAX_AGE) {
  const payload: SessionPayload = {
    n: user.name,
    r: user.role,
    e: Math.floor(Date.now() / 1000) + maxAge,
  }
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(), new TextEncoder().encode(body))
  return `${body}.${toBase64Url(new Uint8Array(signature))}`
}

export async function verifySession(token: string | null | undefined): Promise<SessionUser | null> {
  if (!token) return null
  const [body, signature] = token.split('.')
  if (!body || !signature) return null
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(),
      fromBase64Url(signature),
      new TextEncoder().encode(body),
    )
    if (!valid) return null
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload
    if (!payload?.n || !payload?.e) return null
    if (payload.e < Math.floor(Date.now() / 1000)) return null
    return { name: payload.n, role: payload.r === 'viewer' ? 'viewer' : payload.r }
  } catch {
    return null
  }
}
