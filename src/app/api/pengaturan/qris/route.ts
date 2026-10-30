import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const [qris, nama, rekening] = await Promise.all([
      supabaseAdmin.from('pengaturan_umum').select('value').eq('key', 'qris_payload').maybeSingle(),
      supabaseAdmin.from('pengaturan_umum').select('value').eq('key', 'qris_nama_merchant').maybeSingle(),
      supabaseAdmin.from('pengaturan_umum').select('value').eq('key', 'qris_rekening').maybeSingle(),
    ])
    return NextResponse.json({
      qris_payload: qris.data?.value || '',
      qris_nama_merchant: nama.data?.value || '',
      qris_rekening: rekening.data?.value || '',
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const entries = Object.entries(body).filter(([k]) => k.startsWith('qris_') || k === 'qris_payload' || k === 'qris_nama_merchant' || k === 'qris_rekening')
    for (const [key, value] of entries) {
      await supabaseAdmin.from('pengaturan_umum').upsert({ key, value: value as string }, { onConflict: 'key' })
    }
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
