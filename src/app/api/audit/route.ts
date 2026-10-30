import { NextResponse } from 'next/server'
import { getAuditLog } from '@/lib/queries'

export async function GET() {
  try {
    const data = await getAuditLog(200)
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
