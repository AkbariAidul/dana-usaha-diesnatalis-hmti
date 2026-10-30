import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ponytail: network to Supabase here drops TLS connections intermittently (ECONNRESET)
// and sometimes stalls on the first connection. Fail fast and retry; upgrade to a
// proxy/keep-alive pool if this persists.
const ATTEMPT_TIMEOUT = 8000
const MAX_ATTEMPTS = 6

const retryFetch: typeof fetch = async (input, init) => {
  let lastErr: unknown
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), ATTEMPT_TIMEOUT)
    try {
      return await fetch(input, { ...init, signal: ctrl.signal })
    } catch (err) {
      lastErr = err
      await new Promise((r) => setTimeout(r, 300 * (i + 1)))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr
}

export const supabase = createClient(url, anonKey, { global: { fetch: retryFetch } })

export const supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
  global: { fetch: retryFetch },
})
