import { NextResponse } from 'next/server'
import { GET as reminderTiket } from '../reminder-tiket/route'
import { GET as reminderPo } from '../reminder-po/route'
import { GET as reminderTenant } from '../reminder-tenant/route'
import { GET as reminderAmbil } from '../reminder-ambil/route'
import { GET as waRetry } from '../wa-retry/route'

export const dynamic = 'force-dynamic'

const jobs = {
  'reminder-tiket': reminderTiket,
  'reminder-po': reminderPo,
  'reminder-tenant': reminderTenant,
  'reminder-ambil': reminderAmbil,
  'wa-retry': waRetry,
}

function auth(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : request.headers.get('x-cron-secret')
  return token === secret
}

// ponytail: Hobby Vercel cuma boleh 1 cron harian; semua job dijalankan berurutan.
// Kalau butuh retry WA tiap 10 menit, upgrade Pro lalu jadwalkan /api/cron/wa-retry terpisah.
export async function GET(request: Request) {
  if (!auth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const results: Record<string, unknown> = {}
  for (const [name, handler] of Object.entries(jobs)) {
    const sub = new Request(new URL(`/api/cron/${name}`, request.url), { headers: request.headers })
    const res = await handler(sub)
    results[name] = await res.json().catch(() => ({ status: res.status }))
  }

  return NextResponse.json(results)
}
