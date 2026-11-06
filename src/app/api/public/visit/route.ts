import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requestIp, requestLocation } from '@/lib/request-meta'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const path = String(body.path ?? '').slice(0, 300)
    if (!path.startsWith('/') || path.startsWith('/dankelola') || path.startsWith('/api')) {
      return NextResponse.json({ ok: true })
    }

    const referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, 500) : null
    const visitorId = typeof body.visitor_id === 'string' ? body.visitor_id.slice(0, 100) : null

    const { error } = await supabaseAdmin.from('public_visitor').insert({
      path,
      referrer,
      visitor_id: visitorId,
      user_agent: request.headers.get('user-agent'),
      ip_address: requestIp(request.headers),
      location: requestLocation(request.headers),
    })

    return NextResponse.json({ ok: !error })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
