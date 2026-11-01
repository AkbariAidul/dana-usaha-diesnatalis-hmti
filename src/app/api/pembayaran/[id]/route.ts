import { NextResponse } from 'next/server'
import { deletePembayaran, createAuditLog, syncTenantPaymentStatus } from '@/lib/queries'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const action = body.action as 'approve' | 'reject'

    const { data } = await supabaseAdmin.from('pembayaran').select('tenant_id,validated').eq('id', id).single()
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (action === 'reject') {
      await deletePembayaran(id, data.tenant_id)
      await createAuditLog({ aksi: 'REJECT_PEMBAYARAN', target_type: 'pembayaran', target_id: id })
      return NextResponse.json({ success: true })
    }

    if (action !== 'approve') {
      return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('pembayaran')
      .update({ validated: true })
      .eq('id', id)
    if (error) throw error

    await syncTenantPaymentStatus(data.tenant_id)
    await createAuditLog({ aksi: 'APPROVE_PEMBAYARAN', target_type: 'pembayaran', target_id: id })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

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
