import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session-server'
import { supabaseAdmin } from '@/lib/supabase'
import { createAuditLog } from '@/lib/queries'

export async function POST() {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Tandai semua sesi user yang terbit sebelum sekarang sebagai dicabut.
  await supabaseAdmin
    .from('dashboard_session_jti')
    .insert({ jti: crypto.randomUUID(), user_name: session.name })

  await createAuditLog({
    aksi: 'LOGOUT_ALL_DEVICES',
    target_type: 'auth',
    user_name: session.name,
    data_baru: { action: 'revoke_all_sessions' },
  })

  return NextResponse.json({ success: true })
}

export async function GET() {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('dashboard_session_jti')
    .select('created_at')
    .eq('user_name', session.name)
    .order('created_at', { ascending: false })

  if (error) throw error
  return NextResponse.json(data ?? [])
}
