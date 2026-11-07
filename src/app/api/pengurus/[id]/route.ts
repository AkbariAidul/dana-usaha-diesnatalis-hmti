import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createAuditLog } from '@/lib/queries'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.nama !== undefined) payload.nama = String(body.nama).trim()
    if (body.divisi !== undefined) payload.divisi = body.divisi ? String(body.divisi).trim() : null
    if (body.kontak !== undefined) payload.kontak = body.kontak ? String(body.kontak).trim() : null
    if (body.aktif !== undefined) payload.aktif = !!body.aktif

    const { data, error } = await supabaseAdmin
      .from('pengurus')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    await createAuditLog({ aksi: 'UPDATE_PENGURUS', target_type: 'pengurus', target_id: id, data_baru: data })
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { error } = await supabaseAdmin.from('pengurus').delete().eq('id', id)
    if (error) throw error
    await createAuditLog({ aksi: 'DELETE_PENGURUS', target_type: 'pengurus', target_id: id })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
