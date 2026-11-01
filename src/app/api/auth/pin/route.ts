import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()
  const pin = body.pin as string
  const expectedPin = process.env.DASHBOARD_PIN || '079876'
  const session = process.env.DASHBOARD_SESSION_SECRET || (process.env.NODE_ENV !== 'production' ? 'authenticated' : '')

  if (!session) {
    return NextResponse.json({ error: 'DASHBOARD_SESSION_SECRET belum diset' }, { status: 500 })
  }

  if (pin !== expectedPin) {
    return NextResponse.json({ error: 'PIN salah' }, { status: 401 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('dashboard_session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400,
    path: '/',
  })
  return response
}
