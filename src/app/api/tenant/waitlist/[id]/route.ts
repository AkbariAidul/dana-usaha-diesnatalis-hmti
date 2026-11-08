import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createAuditLog } from '@/lib/queries'
import { getSessionUser } from '@/lib/session-server'

const STATUS_VALID = new Set(['menunggu', 'dihubungi', 'selesai', 'batal'])

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const body = await request.json()
    const status = String(body.status ?? '')
    if (!STATUS_VALID.has(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }
    const { data, error } = await supabaseAdmin
      .from('tenant_waitlist')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    await createAuditLog({
      aksi: 'UPDATE_TENANT_WAITLIST',
      target_type: 'tenant_waitlist',
      target_id: id,
      data_baru: data,
      user_name: session.name,
    })
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
