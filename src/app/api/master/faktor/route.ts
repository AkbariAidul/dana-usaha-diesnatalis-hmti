import { NextResponse } from 'next/server'
import { upsertFaktorHarga, deleteFaktorHarga, createAuditLog } from '@/lib/queries'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = await upsertFaktorHarga(body)
    await createAuditLog({ aksi: body.id ? 'UPDATE_FAKTOR' : 'CREATE_FAKTOR', target_type: 'faktor_harga', target_id: data.id, data_baru: data })
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    await deleteFaktorHarga(id)
    await createAuditLog({ aksi: 'DELETE_FAKTOR', target_type: 'faktor_harga', target_id: id })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
