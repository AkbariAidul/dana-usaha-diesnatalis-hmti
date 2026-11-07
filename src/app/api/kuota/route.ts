import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createAuditLog } from '@/lib/queries'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('kuota_stand')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    console.error('Kuota error:', err)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const { data, error } = await supabaseAdmin
      .from('kuota_stand')
      .insert({
        nama_lokasi: body.nama_lokasi,
        total: body.total || 5,
        terisi: 0,
        sisa: body.total || 5,
        koordinat: body.koordinat || null,
      })
      .select()
      .single()
    
    if (error) throw error
    await createAuditLog({ aksi: 'CREATE_KUOTA', target_type: 'kuota_stand', target_id: data.id, data_baru: data })
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, terisi } = body
    const { data: current } = await supabaseAdmin
      .from('kuota_stand')
      .select('total')
      .eq('id', id)
      .maybeSingle()
    const total = Number(body.total ?? current?.total ?? 0)
    const { data, error } = await supabaseAdmin
      .from('kuota_stand')
      .update({ terisi, sisa: Math.max(0, total - Number(terisi)) })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    await createAuditLog({ aksi: 'UPDATE_KUOTA', target_type: 'kuota_stand', target_id: id, data_baru: data })
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}