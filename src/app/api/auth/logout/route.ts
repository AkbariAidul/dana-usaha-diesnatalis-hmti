import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAuditLog } from '@/lib/queries'

export async function POST() {
  const cookieStore = await cookies()
  let userName: string | null = null
  const rawUser = cookieStore.get('dashboard_user')?.value
  if (rawUser) {
    try {
      userName = JSON.parse(decodeURIComponent(rawUser))?.name ?? null
    } catch {
      userName = null
    }
  }
  await createAuditLog({ aksi: 'LOGOUT', target_type: 'auth', user_name: userName })
  cookieStore.delete('dashboard_session')
  cookieStore.delete('dashboard_user')
  return NextResponse.json({ success: true })
}
