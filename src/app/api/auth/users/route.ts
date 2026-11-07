import { NextResponse } from 'next/server'
import { listDashboardUsers } from '@/lib/auth'
import { loadDashboardUsers } from '@/lib/dashboard-users'

export async function GET() {
  const users = await loadDashboardUsers().catch(() => null)
  if (!users) return NextResponse.json(listDashboardUsers())
  return NextResponse.json(
    users.filter((user) => user.aktif).map((user) => ({ name: user.name, role: user.role })),
  )
}
