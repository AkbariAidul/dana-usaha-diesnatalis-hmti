import { NextResponse } from 'next/server'
import { getTicketBundleDiscount, upsertTicketBundleDiscount, deleteTicketBundleDiscount, createAuditLog } from '@/lib/queries'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const data = await getTicketBundleDiscount(searchParams.get('tipe') || undefined)
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.tiket_tipe_id) throw new Error('Tipe tiket wajib dipilih')
    if (!body.jumlah_min || body.jumlah_min < 2) throw new Error('Jumlah tiket minimal 2')
    if (body.diskon_persen === undefined || Number(body.diskon_persen) < 0) throw new Error('Diskon tidak valid')

    const data = await upsertTicketBundleDiscount(body)
    await createAuditLog({
      aksi: body.id ? 'UPDATE_TICKET_BUNDLE' : 'CREATE_TICKET_BUNDLE',
      target_type: 'tiket_bundle_discount',
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
    await deleteTicketBundleDiscount(id)
    await createAuditLog({ aksi: 'DELETE_TICKET_BUNDLE', target_type: 'tiket_bundle_discount', target_id: id })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
