import { NextResponse } from 'next/server'
import { getAuditLog } from '@/lib/queries'
import { getSessionUser } from '@/lib/session-server'

export async function GET() {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Viewer tidak boleh baca audit log (berisi data sensitif pembayaran & login)
  if (session.role === 'viewer') {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }
  try {
    const data = await getAuditLog(5000)
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
