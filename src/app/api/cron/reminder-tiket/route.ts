import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { kirimNotifReminder } from '@/lib/notifikasi-tiket'
import { getAcara } from '@/lib/queries'
import { todayISO } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function auth(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : request.headers.get('x-cron-secret')
  return token === secret
}

function diffHari(target: string) {
  const today = new Date(`${todayISO()}T00:00:00Z`)
  const acara = new Date(`${target}T00:00:00Z`)
  return Math.round((acara.getTime() - today.getTime()) / 86400000)
}

export async function GET(request: Request) {
  if (!auth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const acara = await getAcara()
    if (!acara?.tanggal_acara) return NextResponse.json({ sent: 0, skipped: 'no_acara_date' })

    const hari = diffHari(acara.tanggal_acara)
    if (hari !== 2 && hari !== 1) return NextResponse.json({ hari, sent: 0 })

    const field = hari === 2 ? 'wa_h2_at' : 'wa_h1_at'

    const { data: pesanan } = await supabaseAdmin
      .from('pesanan_tiket')
      .select('id,no_pesanan,nama_pembeli,kontak,jumlah,total,tiket_tipe_id,wa_h2_at,wa_h1_at')
      .eq('status', 'lunas')
      .is(field, null)

    let sent = 0
    for (const p of pesanan ?? []) {
      const { data: tipe } = await supabaseAdmin
        .from('tiket_tipe')
        .select('nama')
        .eq('id', p.tiket_tipe_id)
        .maybeSingle()

      const ok = await kirimNotifReminder(request, p, tipe?.nama || 'Tiket', hari, acara)
      if (ok) {
        await supabaseAdmin
          .from('pesanan_tiket')
          .update({ [field]: new Date().toISOString() })
          .eq('id', p.id)
        sent++
      }
    }

    return NextResponse.json({ hari, sent })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
