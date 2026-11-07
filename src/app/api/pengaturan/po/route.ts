import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createAuditLog } from '@/lib/queries'

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from('pengaturan_umum')
      .select('value')
      .eq('key', 'po_harga')
      .maybeSingle()
    return NextResponse.json({ harga: Number(data?.value ?? 75000) })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const harga = Number(body.harga)
    if (!Number.isFinite(harga) || harga <= 0) {
      return NextResponse.json({ error: 'Harga tidak valid' }, { status: 400 })
    }
    const { error } = await supabaseAdmin
      .from('pengaturan_umum')
      .upsert({ key: 'po_harga', value: String(Math.round(harga)), updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) throw error
    await createAuditLog({ aksi: 'UPDATE_PENGATURAN_PO', target_type: 'pengaturan_umum', target_id: 'po_harga', data_baru: { harga: Math.round(harga) } })
    return NextResponse.json({ success: true, harga: Math.round(harga) })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
