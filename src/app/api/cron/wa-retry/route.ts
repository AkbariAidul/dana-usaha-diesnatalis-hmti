import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { kirimWhatsAppLangsung } from '@/lib/notifikasi-tiket'
import { apiError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

const MAX_ATTEMPTS = 5
const BATCH = 20

function auth(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : request.headers.get('x-cron-secret')
  return token === secret
}

function backoffMenit(attempts: number) {
  return Math.min(2 ** attempts, 60)
}

export async function GET(request: Request) {
  if (!auth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const now = new Date().toISOString()
    const { data: rows, error } = await supabaseAdmin
      .from('wa_outbox')
      .select('id,target,message,attempts')
      .in('status', ['pending', 'failed'])
      .lt('attempts', MAX_ATTEMPTS)
      .lte('next_retry_at', now)
      .order('next_retry_at', { ascending: true })
      .limit(BATCH)

    if (error) throw error

    let sent = 0
    let failed = 0

    for (const row of rows ?? []) {
      const ok = await kirimWhatsAppLangsung(row.target, row.message)
      const attempts = Number(row.attempts ?? 0) + 1
      const patch = ok
        ? {
            status: 'sent',
            attempts,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_error: null,
          }
        : {
            status: 'failed',
            attempts,
            updated_at: new Date().toISOString(),
            last_error: 'Gagal kirim via Fonnte',
            next_retry_at: new Date(Date.now() + backoffMenit(attempts) * 60000).toISOString(),
          }
      await supabaseAdmin.from('wa_outbox').update(patch).eq('id', row.id)
      if (ok) sent++
      else failed++
    }

    return NextResponse.json({ processed: rows?.length ?? 0, sent, failed })
  } catch (err: unknown) {
    return apiError(err)
  }
}
