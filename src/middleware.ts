import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === '/dankelola/login') {
    return NextResponse.next()
  }
  if (pathname.startsWith('/dankelola')) {
    const session = request.cookies.get('dashboard_session')?.value
    if (!session) {
      return NextResponse.redirect(new URL('/dankelola/login', request.url))
    }
  }
  return NextResponse.next()
}

export default middleware

export const config = {
  matcher: ['/dankelola/:path*'],
}
