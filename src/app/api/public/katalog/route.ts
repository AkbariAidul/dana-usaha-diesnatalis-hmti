import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTicketKatalog } from '@/lib/queries'

export async function GET() {
  try {
    const [tiket, varian] = await Promise.all([
      getTicketKatalog().then((rows) =>
        rows.map((t) => {
          const copy = { ...t } as Record<string, unknown>
          delete copy.modal
          return copy
        })
      ),
      supabaseAdmin.from('merch_varian').select('*').eq('aktif', true).order('urutan'),
    ])
    return NextResponse.json({ tiket, varian: varian.data || [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
