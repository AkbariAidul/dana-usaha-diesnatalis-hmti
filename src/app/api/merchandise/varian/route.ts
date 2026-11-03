import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('merch_varian')
      .select('id,nama,urutan')
      .eq('aktif', true)
      .order('urutan')
      .order('nama')
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
