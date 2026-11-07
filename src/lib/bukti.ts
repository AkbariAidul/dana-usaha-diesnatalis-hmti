export function isBuktiUrl(value: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
  if (!base) return false
  try {
    const url = new URL(value)
    const origin = new URL(base).origin
    return url.origin === origin && url.pathname.startsWith('/storage/v1/object/public/bukti/')
  } catch {
    return false
  }
}
