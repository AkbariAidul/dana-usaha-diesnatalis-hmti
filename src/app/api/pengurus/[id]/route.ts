import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
