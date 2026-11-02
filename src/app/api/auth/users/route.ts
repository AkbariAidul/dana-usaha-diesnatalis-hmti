import { NextResponse } from 'next/server'
import { listDashboardUsers } from '@/lib/auth'

export async function GET() {
  return NextResponse.json(listDashboardUsers())
}
