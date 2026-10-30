import { NextResponse } from 'next/server'
import { getAcara, upsertAcara, createAuditLog } from '@/lib/queries'

export async function GET() {
  try {
    const data = await getAcara()
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = await upsertAcara(body)
    await createAuditLog({ aksi: 'UPSERT_ACARA', target_type: 'acara', data_baru: data })
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
