type Entry = { data: unknown; at: number }

const cache = new Map<string, Entry>()
const inflight = new Map<string, Promise<unknown>>()
const TTL = 30_000

async function fetchStore<T>(url: string): Promise<T> {
  const pending = inflight.get(url)
  if (pending) return pending as Promise<T>
  const p = fetch(url, { cache: 'no-store' })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data')
      cache.set(url, { data, at: Date.now() })
      return data as T
    })
    .finally(() => inflight.delete(url))
  inflight.set(url, p)
  return p
}

export async function getJSON<T>(url: string): Promise<T> {
  const hit = cache.get(url)
  if (hit) {
    if (Date.now() - hit.at > TTL) {
      void fetchStore<T>(url).catch(() => {})
    }
    return hit.data as T
  }
  return fetchStore<T>(url)
}

export function bustCache(prefix?: string) {
  if (!prefix) { cache.clear(); return }
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k)
}

export function prefetch(urls: string[]) {
  urls.forEach((u) => { void getJSON(u).catch(() => {}) })
}

export async function sendJSON(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Gagal menyimpan')
  bustCache()
  return data
}
