import { NextResponse } from 'next/server'
import { deletePembayaran, createAuditLog } from '@/lib/queries'
import { supabase } from '@/lib/supabase'

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    // Ambil dulu untuk tau tenant_id
    const { data } = await supabase.from('pembayaran').select('tenant_id').eq('id', id).single()
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await deletePembayaran(id, data.tenant_id)
    await createAuditLog({ aksi: 'DELETE_PEMBAYARAN', target_type: 'pembayaran', target_id: id })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
