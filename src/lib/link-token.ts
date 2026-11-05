import { createHmac, timingSafeEqual } from 'crypto'

export type TipeLacak = 'tenant' | 'tiket' | 'po'

function secret() {
  return process.env.PUBLIC_LINK_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || 'dana-usaha-hmti-dev-secret'
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
  return `DN26|${tipe.toUpperCase()}|${kode.trim().toUpperCase()}|${signRef(tipe, kode)}`
}

export function parseQrPayload(payload: string): { tipe: TipeLacak; kode: string } | null {
  const [prefix, tipeRaw, kode, token] = payload.trim().split('|')
  if (prefix !== 'DN26' || !tipeRaw || !kode || !token) return null
  const tipe = tipeRaw.toLowerCase() as TipeLacak
  if (!['tenant', 'tiket', 'po'].includes(tipe)) return null
  if (!verifyRef(tipe, kode, token)) return null
  return { tipe, kode: kode.toUpperCase() }
}
