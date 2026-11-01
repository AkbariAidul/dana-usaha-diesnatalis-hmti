import { NextResponse } from 'next/server'
import { getTicketKatalog, upsertTicket, deleteTicket, createAuditLog } from '@/lib/queries'

export async function GET() {
  try {
    const data = await getTicketKatalog()
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = await upsertTicket(body)
    await createAuditLog({
      aksi: body.id ? 'UPDATE_TICKET' : 'CREATE_TICKET',
      target_type: 'ticket',
      target_id: data.id,
      data_baru: data,
    })
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    await deleteTicket(id)
    await createAuditLog({ aksi: 'DELETE_TICKET', target_type: 'ticket', target_id: id })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
