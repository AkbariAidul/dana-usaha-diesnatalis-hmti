import { NextResponse } from 'next/server'
import { getPilihanModal, savePilihanModal } from '@/lib/peralatan'

export async function GET() {
  try {
    return NextResponse.json(await getPilihanModal())
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const nama = String(body.nama ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
    const modal = Number(body.modal ?? 0)
    if (!nama) return NextResponse.json({ error: 'Nama item wajib diisi' }, { status: 400 })
    if (!Number.isFinite(modal) || modal < 0) return NextResponse.json({ error: 'Modal tidak valid' }, { status: 400 })

    const map = await getPilihanModal()
    map[nama] = Math.round(modal)
    await savePilihanModal(map)
    return NextResponse.json(map)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
