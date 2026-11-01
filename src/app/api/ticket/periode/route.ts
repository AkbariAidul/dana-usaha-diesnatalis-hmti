import { NextResponse } from 'next/server'
import { getTicketPeriode, upsertTicketPeriode, deleteTicketPeriode, createAuditLog } from '@/lib/queries'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const data = await getTicketPeriode(searchParams.get('tipe') || undefined)
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.tiket_tipe_id) throw new Error('Tipe tiket wajib dipilih')
    if (!body.tanggal_mulai || !body.tanggal_selesai) throw new Error('Tanggal periode wajib diisi')
    if (body.tanggal_selesai < body.tanggal_mulai) throw new Error('Tanggal selesai harus setelah tanggal mulai')
    if (Number(body.harga) < 0) throw new Error('Harga tidak valid')

    const data = await upsertTicketPeriode(body)
    await createAuditLog({
      aksi: body.id ? 'UPDATE_TICKET_PERIODE' : 'CREATE_TICKET_PERIODE',
      target_type: 'tiket_periode',
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
    await deleteTicketPeriode(id)
    await createAuditLog({ aksi: 'DELETE_TICKET_PERIODE', target_type: 'tiket_periode', target_id: id })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
