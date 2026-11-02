import { NextResponse } from 'next/server'
import { getTicketModalItem, upsertTicketModalItem, deleteTicketModalItem, createAuditLog } from '@/lib/queries'

export async function GET() {
  try {
    const data = await getTicketModalItem()
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!String(body.nama ?? '').trim()) throw new Error('Nama item wajib diisi')
    const harga = Number(body.harga)
    if (!Number.isFinite(harga) || harga < 0) throw new Error('Harga modal tidak valid')

    const data = await upsertTicketModalItem({ ...body, nama: String(body.nama).trim(), harga })
    await createAuditLog({
      aksi: body.id ? 'UPDATE_TICKET_MODAL' : 'CREATE_TICKET_MODAL',
      target_type: 'tiket_modal_item',
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
    await deleteTicketModalItem(id)
    await createAuditLog({ aksi: 'DELETE_TICKET_MODAL', target_type: 'tiket_modal_item', target_id: id })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
