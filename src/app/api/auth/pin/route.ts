import { NextResponse } from 'next/server'
import { findActiveUserByPIN } from '@/lib/dashboard-users'
import { createAuditLog } from '@/lib/queries'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session'
import { turnstileFailure, verifyTurnstile } from '@/lib/turnstile'

export async function POST(request: Request) {
  const ip = clientIp(request.headers)
  if (!rateLimit(`login:${ip}`, 8, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' }, { status: 429 })
  }

  const body = await request.json()
  const pin = String(body.pin ?? '')
  const turnstile = await verifyTurnstile(body.turnstile_token, request.headers)
  if (!turnstile.ok) {
    const failure = turnstileFailure(turnstile.reason)
    return NextResponse.json({ error: failure.error }, { status: failure.status })
  }
  if (!process.env.DASHBOARD_SESSION_SECRET && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'DASHBOARD_SESSION_SECRET belum diset' }, { status: 500 })
  }

  const dbUser = await findActiveUserByPIN(pin).catch(() => null)
  const user = dbUser ? { name: dbUser.name, role: dbUser.role } : null
  if (!user) {
    return NextResponse.json({ error: 'PIN salah' }, { status: 401 })
  }

  const token = await signSession(user)
  const response = NextResponse.json({ success: true, user })
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
  response.cookies.delete('dashboard_user')
  response.cookies.delete('dashboard_role')
  await createAuditLog({
    aksi: 'LOGIN',
    target_type: 'auth',
    data_baru: { role: user.role },
    user_name: user.name,
  })
  return response
}
