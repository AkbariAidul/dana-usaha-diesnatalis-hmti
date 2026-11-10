import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
]

export async function GET() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key])
  const checks: Record<string, string> = {
    env: missing.length === 0 ? 'ok' : `missing: ${missing.join(', ')}`,
  }

  let ok = missing.length === 0
  try {
    const { error } = await supabaseAdmin.from('acara').select('id', { head: true, count: 'exact' }).limit(1)
    checks.database = error ? `error: ${error.message}` : 'ok'
    if (error) ok = false
  } catch (err) {
    checks.database = `error: ${err instanceof Error ? err.message : 'unknown'}`
    ok = false
  }

  checks.fonnte = process.env.FONNTE_TOKEN ? 'ok' : 'not_configured'

  return NextResponse.json(
    { ok, time: new Date().toISOString(), checks },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
