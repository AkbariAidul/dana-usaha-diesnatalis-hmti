import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const [pengurus, varian, harga] = await Promise.all([
      supabaseAdmin.from('pengurus').select('id,nama,divisi,kontak').eq('aktif', true).order('nama'),
      supabaseAdmin.from('merch_varian').select('*').eq('aktif', true).order('urutan'),
      supabaseAdmin.from('pengaturan_umum').select('value').eq('key', 'po_harga').maybeSingle(),
    ])
    return NextResponse.json({
      pengurus: pengurus.data ?? [],
      varian: varian.data ?? [],
      harga: Number(harga.data?.value ?? 75000),
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
