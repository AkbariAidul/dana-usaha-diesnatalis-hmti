import { NextResponse } from 'next/server'
import { findUserByPIN } from '@/lib/auth'
import { findActiveUserByPIN } from '@/lib/dashboard-users'
import { createAuditLog } from '@/lib/queries'

export async function POST(request: Request) {
  const body = await request.json()
  const pin = String(body.pin ?? '')
  const session = process.env.DASHBOARD_SESSION_SECRET || (process.env.NODE_ENV !== 'production' ? 'authenticated' : '')

  if (!session) {
    return NextResponse.json({ error: 'DASHBOARD_SESSION_SECRET belum diset' }, { status: 500 })
  }

  const dbUser = await findActiveUserByPIN(pin).catch(() => null)
  const user = dbUser ? { name: dbUser.name, role: dbUser.role } : findUserByPIN(pin)
  if (!user) {
    return NextResponse.json({ error: 'PIN salah' }, { status: 401 })
  }

  const response = NextResponse.json({ success: true, user })
  response.cookies.set('dashboard_session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400,
    path: '/',
  })
  response.cookies.set('dashboard_user', JSON.stringify(user), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400,
    path: '/',
  })
  response.cookies.set('dashboard_role', user.role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400,
    path: '/',
  })
  await createAuditLog({
    aksi: 'LOGIN',
    target_type: 'auth',
    data_baru: { role: user.role },
    user_name: user.name,
  })
  return response
}
