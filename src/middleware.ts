import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySession } from '@/lib/session'

const PUBLIC_API: Array<{ method: string; pattern: RegExp }> = [
  { method: 'GET', pattern: /^\/api\/cron\// },
  { method: 'POST', pattern: /^\/api\/auth\/pin$/ },
  { method: 'POST', pattern: /^\/api\/auth\/logout$/ },
  { method: 'POST', pattern: /^\/api\/public\/lookup$/ },
  { method: 'GET', pattern: /^\/api\/public\/status$/ },
  { method: 'GET', pattern: /^\/api\/public\/struk$/ },
  { method: 'POST', pattern: /^\/api\/public\/status\/bukti$/ },
  { method: 'GET', pattern: /^\/api\/public\/katalog$/ },
  { method: 'GET', pattern: /^\/api\/public\/produk$/ },
  { method: 'GET', pattern: /^\/api\/public\/po\/katalog$/ },
  { method: 'GET', pattern: /^\/api\/public\/tenant\/pilihan$/ },
  { method: 'GET', pattern: /^\/api\/public\/tenant\/katalog$/ },
  { method: 'GET', pattern: /^\/api\/public\/peralatan$/ },
  { method: 'POST', pattern: /^\/api\/public\/po$/ },
  { method: 'POST', pattern: /^\/api\/public\/tenant$/ },
  { method: 'POST', pattern: /^\/api\/public\/tenant\/waitlist$/ },
  { method: 'POST', pattern: /^\/api\/public\/tenant\/[^/]+\/bukti$/ },
  { method: 'GET', pattern: /^\/api\/public\/tenant\/[^/]+\/grup$/ },
  { method: 'POST', pattern: /^\/api\/public\/tiket$/ },
  { method: 'POST', pattern: /^\/api\/public\/tiket\/[^/]+\/bukti$/ },
  { method: 'POST', pattern: /^\/api\/public\/visit$/ },
  { method: 'GET', pattern: /^\/api\/pengaturan\/qris$/ },
  { method: 'POST', pattern: /^\/api\/upload$/ },
]

const VIEWER_ALLOWED_WRITE = new Set(['/api/audit/page'])
// Viewer TIDAK boleh akses audit log sama sekali (berisi data sensitif pembayaran & login)

const VIEWER_BLOCKED_PAGES: Array<{ pattern: RegExp; redirectTo: string }> = [
  { pattern: /^\/dankelola\/tenants\/harga\/new$/, redirectTo: '/dankelola/tenants/harga' },
  { pattern: /^\/dankelola\/tenants\/harga\/[^/]+\/edit$/, redirectTo: '/dankelola/tenants/harga' },
  { pattern: /^\/dankelola\/tenants\/pembayaran$/, redirectTo: '/dankelola/tenants/harga' },
  { pattern: /^\/dankelola\/merchandise\/produk\/new$/, redirectTo: '/dankelola/merchandise/produk' },
  { pattern: /^\/dankelola\/merchandise\/produk\/[^/]+\/edit$/, redirectTo: '/dankelola/merchandise/produk' },
  { pattern: /^\/dankelola\/ticket\/tipe\/new$/, redirectTo: '/dankelola/ticket/tahap' },
  { pattern: /^\/dankelola\/ticket\/tipe\/[^/]+\/edit$/, redirectTo: '/dankelola/ticket/tahap' },
]

function isPublicApi(method: string, pathname: string) {
  return PUBLIC_API.some((entry) => entry.method === method && entry.pattern.test(pathname))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const user = await verifySession(request.cookies.get(SESSION_COOKIE)?.value)

  if (pathname.startsWith('/api/')) {
    if (isPublicApi(request.method, pathname)) return NextResponse.next()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (
      user.role === 'viewer' &&
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      !VIEWER_ALLOWED_WRITE.has(pathname)
    ) {
      return NextResponse.json({ error: 'Mode lihat saja: perubahan data tidak diizinkan' }, { status: 403 })
    }
    return NextResponse.next()
  }

  if (pathname === '/dankelola/login') return NextResponse.next()

  if (pathname.startsWith('/dankelola') && !user) {
    return NextResponse.redirect(new URL('/dankelola/login', request.url))
  }

  if (pathname.startsWith('/dankelola') && user?.role === 'viewer') {
    const blocked = VIEWER_BLOCKED_PAGES.find((entry) => entry.pattern.test(pathname))
    if (blocked) return NextResponse.redirect(new URL(blocked.redirectTo, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dankelola/:path*', '/api/:path*'],
}
