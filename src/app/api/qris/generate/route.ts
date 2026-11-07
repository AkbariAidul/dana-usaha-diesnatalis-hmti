import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { createAuditLog } from '@/lib/queries'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payload = body.payload || body.qris_payload || ''
    if (!payload) return NextResponse.json({ error: 'Payload QRIS wajib diisi' }, { status: 400 })
    const dataUrl = await QRCode.toDataURL(payload, { width: 512, margin: 1 })
    await createAuditLog({ aksi: 'GENERATE_QRIS', target_type: 'qris' })
    return NextResponse.json({ dataUrl, payload })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
