import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { kirimWhatsAppLangsung } from '@/lib/notifikasi-tiket'
import { apiError } from '@/lib/api-error'

const STATUS_VALID = new Set(['pending', 'sent', 'failed'])

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    let query = supabaseAdmin
      .from('wa_outbox')
      .select('id,target,message,ref_type,ref_id,status,attempts,last_error,next_retry_at,created_at,sent_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (status && STATUS_VALID.has(status)) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function POST(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 })

    const { data: row } = await supabaseAdmin
      .from('wa_outbox')
      .select('id,target,message,attempts')
      .eq('id', id)
      .maybeSingle()
    if (!row) return NextResponse.json({ error: 'Pesan tidak ditemukan' }, { status: 404 })

    const ok = await kirimWhatsAppLangsung(row.target, row.message)
    const attempts = Number(row.attempts ?? 0) + 1
    const patch = ok
      ? { status: 'sent', attempts, sent_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null }
      : {
          status: 'failed',
          attempts,
          updated_at: new Date().toISOString(),
          last_error: 'Gagal kirim via Fonnte',
          next_retry_at: new Date(Date.now() + Math.min(2 ** attempts, 60) * 60000).toISOString(),
        }

    const { data, error } = await supabaseAdmin
      .from('wa_outbox')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    return apiError(err)
  }
}
