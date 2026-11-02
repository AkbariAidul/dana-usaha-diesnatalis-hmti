import { NextResponse } from 'next/server'
import { getTicketPenjualan } from '@/lib/queries'

export async function GET() {
  try {
    const data = await getTicketPenjualan()
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
