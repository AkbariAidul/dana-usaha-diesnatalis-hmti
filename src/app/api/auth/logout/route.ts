import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  cookieStore.delete('dashboard_session')
  const origin = new URL(request.url).origin
  return NextResponse.redirect(`${origin}/dankelola/login`)
}
