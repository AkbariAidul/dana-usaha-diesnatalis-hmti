import { NextResponse } from 'next/server'
import { getKategoriPilihan } from '@/lib/queries'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    return NextResponse.json(await getKategoriPilihan(searchParams.get('kategori') || undefined))
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
