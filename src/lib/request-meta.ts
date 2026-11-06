export type HeaderReader = {
  get(name: string): string | null
}

function decode(value: string | null) {
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function requestIp(headers: HeaderReader) {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const raw = forwarded || headers.get('x-real-ip')?.trim() || ''
  const normalized = raw.replace(/^\[|\]$/g, '')
  return /^[0-9a-fA-F:.]+$/.test(normalized) ? normalized : null
}

export function requestLocation(headers: HeaderReader) {
  const city = decode(headers.get('x-vercel-ip-city')) || decode(headers.get('cf-ipcity'))
  const region = decode(headers.get('x-vercel-ip-country-region'))
  const country = headers.get('x-vercel-ip-country') || headers.get('cf-ipcountry')
  return [city, region, country].filter(Boolean).join(', ') || null
}

export function parseUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return { browser: 'Tidak diketahui', os: 'Tidak diketahui', device: 'Tidak diketahui' }

  const ua = userAgent.toLowerCase()
  const browser =
    ua.includes('edg/') ? 'Edge'
    : ua.includes('opr/') || ua.includes('opera') ? 'Opera'
    : ua.includes('chrome/') || ua.includes('crios/') ? 'Chrome'
    : ua.includes('firefox/') || ua.includes('fxios/') ? 'Firefox'
    : ua.includes('safari/') ? 'Safari'
    : 'Browser lain'

  const os =
    ua.includes('android') ? 'Android'
    : ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod') ? 'iOS'
    : ua.includes('windows') ? 'Windows'
    : ua.includes('mac os') || ua.includes('macintosh') ? 'macOS'
    : ua.includes('linux') ? 'Linux'
    : 'OS lain'

  const device =
    ua.includes('ipad') || ua.includes('tablet') ? 'Tablet'
    : ua.includes('mobile') || ua.includes('android') || ua.includes('iphone') ? 'HP'
    : 'Desktop'

  return { browser, os, device }
}

export function userAgentLabel(userAgent: string | null | undefined) {
  const parsed = parseUserAgent(userAgent)
  return `${parsed.browser} · ${parsed.os}`
}
