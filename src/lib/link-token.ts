import { createHmac, timingSafeEqual } from 'crypto'

export type TipeLacak = 'tenant' | 'tiket' | 'po'

function secret() {
  if (process.env.PUBLIC_LINK_SECRET) return process.env.PUBLIC_LINK_SECRET
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY
  if (process.env.NODE_ENV === 'production') throw new Error('PUBLIC_LINK_SECRET belum diset')
  return 'dana-usaha-hmti-dev-secret'
}

export function tipeDariKode(kode: string): TipeLacak | null {
  const upper = kode.trim().toUpperCase()
  if (upper.startsWith('TP-') || upper.startsWith('KT-')) return 'tenant'
  if (upper.startsWith('TK-')) return 'tiket'
  if (upper.startsWith('PO-')) return 'po'
  return null
}

export function signRef(tipe: TipeLacak, kode: string) {
  return createHmac('sha256', secret())
    .update(`${tipe}:${kode.trim().toUpperCase()}`)
    .digest('base64url')
}

export function verifyRef(tipe: TipeLacak, kode: string, token: string | null) {
  if (!token) return false
  const expected = signRef(tipe, kode)
  const a = Buffer.from(expected)
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function buatQrPayload(tipe: TipeLacak, kode: string) {
  // Timestamp expiry 30 hari dari sekarang (Unix epoch seconds)
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
  return `DN26|${tipe.toUpperCase()}|${kode.trim().toUpperCase()}|${signRef(tipe, kode)}|${expiresAt}`
}

export function parseQrPayload(payload: string): { tipe: TipeLacak; kode: string; expiresAt: number } | null {
  const parts = payload.trim().split('|')
  // Backward compat: old QRs have 4 parts (no expiry), new ones have 5
  if ((parts.length !== 4 && parts.length !== 5) || parts[0] !== 'DN26' || !parts[1] || !parts[2] || !parts[3]) return null
  const tipeRaw = parts[1]
  const kode = parts[2]
  const token = parts[3]
  const expiresAtStr = parts[4] ?? ''
  if (!['tenant', 'tiket', 'po'].includes(tipeRaw.toLowerCase())) return null
  const tipe = tipeRaw.toLowerCase() as TipeLacak
  if (!verifyRef(tipe, kode, token)) return null
  // Old-format QRs (no expiry field) are treated as never-expiring for backward compat
  const expiresAt = expiresAtStr ? Number(expiresAtStr) : 0
  if (expiresAtStr && (!Number.isFinite(expiresAt) || expiresAt <= 0)) return null
  return { tipe, kode: kode.toUpperCase(), expiresAt }
}
