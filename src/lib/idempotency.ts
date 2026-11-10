const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Kembalikan UUID valid atau null. Nilai aneh tidak boleh sampai ke cast Postgres. */
export function normalizeIdempotency(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return UUID_RE.test(text) ? text : null
}
