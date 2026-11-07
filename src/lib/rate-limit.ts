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
  if (buckets.size > 5000) buckets.clear()
  return true
}

export function clientIp(headers: Headers) {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  )
}
