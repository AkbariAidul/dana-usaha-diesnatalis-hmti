import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createAuditLog } from '@/lib/queries'

const KEYS = ['wa_group_nama', 'wa_group_link'] as const

export async function GET() {
  try {
    const rows = await Promise.all(
      KEYS.map((key) => supabaseAdmin.from('pengaturan_umum').select('value').eq('key', key).maybeSingle()),
    )
    return NextResponse.json({
      wa_group_nama: rows[0].data?.value || '',
      wa_group_link: rows[1].data?.value || '',
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    for (const key of KEYS) {
      if (typeof body[key] === 'string') {
        await supabaseAdmin.from('pengaturan_umum').upsert({ key, value: body[key] }, { onConflict: 'key' })
      }
    }
    await createAuditLog({
      aksi: 'UPDATE_PENGATURAN_TENANT',
      target_type: 'pengaturan_umum',
      target_id: 'wa_group',
      data_baru: { keys: KEYS },
    })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
