import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_API: Array<{ method: string; pattern: RegExp }> = [
  { method: 'POST', pattern: /^\/api\/auth\/pin$/ },
  { method: 'POST', pattern: /^\/api\/auth\/logout$/ },
  { method: 'POST', pattern: /^\/api\/public\/lookup$/ },
  { method: 'GET', pattern: /^\/api\/public\/status$/ },
  { method: 'POST', pattern: /^\/api\/public\/status\/bukti$/ },
  { method: 'GET', pattern: /^\/api\/public\/katalog$/ },
  { method: 'GET', pattern: /^\/api\/public\/po\/katalog$/ },
  { method: 'POST', pattern: /^\/api\/public\/po$/ },
  { method: 'POST', pattern: /^\/api\/public\/tenant$/ },
  { method: 'POST', pattern: /^\/api\/public\/tenant\/[^/]+\/bukti$/ },
  { method: 'POST', pattern: /^\/api\/public\/tiket$/ },
  { method: 'POST', pattern: /^\/api\/public\/tiket\/[^/]+\/bukti$/ },
  { method: 'GET', pattern: /^\/api\/master$/ },
  { method: 'GET', pattern: /^\/api\/acara$/ },
  { method: 'GET', pattern: /^\/api\/pengaturan\/qris$/ },
  { method: 'POST', pattern: /^\/api\/upload$/ },
]

function isPublicApi(method: string, pathname: string) {
  return PUBLIC_API.some((entry) => entry.method === method && entry.pattern.test(pathname))
}

function sessionToken() {
  if (process.env.DASHBOARD_SESSION_SECRET) return process.env.DASHBOARD_SESSION_SECRET
  return process.env.NODE_ENV === 'production' ? '' : 'authenticated'
}

function hasSession(request: NextRequest) {
  const token = sessionToken()
  return !!token && request.cookies.get('dashboard_session')?.value === token
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/')) {
    if (isPublicApi(request.method, pathname)) return NextResponse.next()
    if (!hasSession(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  if (pathname === '/dankelola/login') return NextResponse.next()

  if (pathname.startsWith('/dankelola') && !hasSession(request)) {
    return NextResponse.redirect(new URL('/dankelola/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dankelola/:path*', '/api/:path*'],
}
