import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const [tipe, varian] = await Promise.all([
      supabaseAdmin.from('tiket_tipe').select('*').eq('aktif', true).order('urutan'),
      supabaseAdmin.from('merch_varian').select('*').eq('aktif', true).order('urutan'),
    ])
    return NextResponse.json({ tiket: tipe.data || [], varian: varian.data || [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
