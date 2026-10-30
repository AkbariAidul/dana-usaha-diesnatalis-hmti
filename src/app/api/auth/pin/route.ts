import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()
  const pin = body.pin as string
  const expectedPin = process.env.NEXT_PUBLIC_DASHBOARD_PIN || '079876'

  if (pin !== expectedPin) {
    return NextResponse.json({ error: 'PIN salah' }, { status: 401 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('dashboard_session', 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400,
    path: '/',
  })
  return response
}
