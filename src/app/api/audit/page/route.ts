import { NextResponse } from 'next/server'
import { createAuditLog } from '@/lib/queries'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const path = typeof body.path === 'string' ? body.path.trim().slice(0, 300) : ''
    if (!path.startsWith('/dankelola')) {
      return NextResponse.json({ error: 'Path tidak valid' }, { status: 400 })
    }
    await createAuditLog({
      aksi: 'BUKA_HALAMAN',
      target_type: 'page',
      target_id: path,
      data_baru: { path },
    })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
