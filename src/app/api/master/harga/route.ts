import { NextResponse } from 'next/server'
import { upsertHargaDasar, deleteHargaDasar, createAuditLog } from '@/lib/queries'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = await upsertHargaDasar(body)
    await createAuditLog({ aksi: body.id ? 'UPDATE_HARGA_DASAR' : 'CREATE_HARGA_DASAR', target_type: 'harga_dasar', target_id: data.id, data_baru: data })
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    await deleteHargaDasar(id)
    await createAuditLog({ aksi: 'DELETE_HARGA_DASAR', target_type: 'harga_dasar', target_id: id })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
