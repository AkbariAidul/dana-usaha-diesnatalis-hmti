import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAuditLog } from '@/lib/queries'
import { getSessionUser } from '@/lib/session-server'
import { SESSION_COOKIE } from '@/lib/session'

export async function POST() {
  const user = await getSessionUser()
  await createAuditLog({ aksi: 'LOGOUT', target_type: 'auth', user_name: user?.name ?? null })
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  cookieStore.delete('dashboard_user')
  cookieStore.delete('dashboard_role')
  return NextResponse.json({ success: true })
}
