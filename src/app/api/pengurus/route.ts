import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createAuditLog } from '@/lib/queries'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('pengurus')
      .select('*')
      .order('nama')
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const nama = String(body.nama ?? '').trim()
    if (!nama) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('pengurus')
      .insert({
        nama,
        divisi: body.divisi ? String(body.divisi).trim() : null,
        kontak: body.kontak ? String(body.kontak).trim() : null,
        aktif: body.aktif !== false,
      })
      .select()
      .single()
    if (error) throw error
    await createAuditLog({ aksi: 'CREATE_PENGURUS', target_type: 'pengurus', target_id: data.id, data_baru: data })
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
