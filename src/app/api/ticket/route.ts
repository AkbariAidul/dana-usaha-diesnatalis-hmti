import { NextResponse } from 'next/server'
import { getTicketKatalog, upsertTicket, deleteTicket, createAuditLog } from '@/lib/queries'

function errMsg(err: unknown): string {
  if (!err) return 'Terjadi kesalahan'
  if (typeof err === 'string') return err
  if (typeof (err as Record<string, unknown>)?.message === 'string') return (err as Record<string, unknown>).message as string
  if (typeof (err as Record<string, unknown>)?.details === 'string') return (err as Record<string, unknown>).details as string
  return String(err)
}

export async function GET() {
  try {
    const data = await getTicketKatalog()
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (body.modal !== undefined) {
      const modal = Number(body.modal)
      if (!Number.isFinite(modal) || modal < 0) throw new Error('Modal tidak valid')
      body.modal = modal
    }
    const data = await upsertTicket(body)
    await createAuditLog({
      aksi: body.id ? 'UPDATE_TICKET' : 'CREATE_TICKET',
      target_type: 'ticket',
      target_id: data.id,
      data_baru: data,
    })
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    await deleteTicket(id)
    await createAuditLog({ aksi: 'DELETE_TICKET', target_type: 'ticket', target_id: id })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 })
  }
}
