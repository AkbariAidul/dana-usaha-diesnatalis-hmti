import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createAuditLog } from '@/lib/queries'

const KEY_TANGGAL = 'merch_pengambilan_tanggal'
const KEY_LOKASI = 'merch_pengambilan_lokasi'

export async function GET() {
  try {
    const [tgl, lokasi] = await Promise.all([
      supabaseAdmin.from('pengaturan_umum').select('value').eq('key', KEY_TANGGAL).maybeSingle(),
      supabaseAdmin.from('pengaturan_umum').select('value').eq('key', KEY_LOKASI).maybeSingle(),
    ])
    return NextResponse.json({
      tanggal: tgl.data?.value || '',
      lokasi: lokasi.data?.value || '',
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const tanggal = String(body.tanggal || '').trim()
    const lokasi = String(body.lokasi || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 })
    }
    if (!lokasi) {
      return NextResponse.json({ error: 'Lokasi wajib diisi' }, { status: 400 })
    }
    const now = new Date().toISOString()
    const { error } = await supabaseAdmin.from('pengaturan_umum').upsert(
      [
        { key: KEY_TANGGAL, value: tanggal, updated_at: now },
        { key: KEY_LOKASI, value: lokasi, updated_at: now },
      ],
      { onConflict: 'key' }
    )
    if (error) throw error
    await createAuditLog({
      aksi: 'UPDATE_PENGATURAN_MERCHANDISE',
      target_type: 'pengaturan_umum',
      target_id: 'merch_pengambilan',
      data_baru: { tanggal, lokasi },
    })
    return NextResponse.json({ success: true, tanggal, lokasi })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
