const buckets = new Map<string, number[]>()

// ponytail: in-memory per-instance limiter; move to Redis/Upstash if traffic spans instances.
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const list = (buckets.get(key) ?? []).filter((time) => now - time < windowMs)
  if (list.length >= max) {
    buckets.set(key, list)
    return false
  }
  list.push(now)
  buckets.set(key, list)
  // ponytail: only evict oldest entries, never clear all — prevents self-DDoS via key flooding
  if (buckets.size > 5000) {
    const entries = [...buckets.entries()]
    entries.sort((a, b) => (a[1]?.[0] ?? 0) - (b[1]?.[0] ?? 0))
    // Keep only the 3000 most recent keys
    for (const [k] of entries.slice(0, entries.length - 3000)) {
      buckets.delete(k)
    }
  }
  return true
}

export function clientIp(headers: Headers): string {
  // Vercel sets x-real-ip; x-forwarded-for may contain multiple values
  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    // Take the FIRST non-private IP (Vercel appends its own IP at the end)
    const parts = forwarded.split(',').map((s) => s.trim())
    for (const part of parts) {
      // Skip RFC1918 private ranges and known proxy IPs
      if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1)/.test(part)) continue
      return part
    }
    return parts[0] || 'unknown'
  }
  return 'unknown'
}
