const PUBLIC_MARKER = '/storage/v1/object/public/'

/**
 * Ambil path relatif-bucket dari public URL Supabase Storage.
 * Contoh: https://xxx.supabase.co/storage/v1/object/public/bukti/kasir-bukti/a.webp
 *   -> "kasir-bukti/a.webp"
 */
export function storagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const pathname = new URL(url).pathname
    const idx = pathname.indexOf(PUBLIC_MARKER)
    if (idx === -1) return null
    const rest = pathname.slice(idx + PUBLIC_MARKER.length)
    const slash = rest.indexOf('/')
    if (slash === -1) return null
    const path = decodeURIComponent(rest.slice(slash + 1))
    return path || null
  } catch {
    return null
  }
}
