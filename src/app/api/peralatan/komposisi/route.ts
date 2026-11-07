import { NextResponse } from 'next/server'
import { getKomposisiPeralatan, saveKomposisiPeralatan } from '@/lib/peralatan'
import type { KomposisiPeralatan } from '@/lib/types'
import { createAuditLog } from '@/lib/queries'

export async function GET() {
  try {
    return NextResponse.json(await getKomposisiPeralatan())
  } catch (err: unknown) {
    console.error('Komposisi peralatan error:', err)
    return NextResponse.json({}, { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Format komposisi tidak valid' }, { status: 400 })
    }
    const clean: KomposisiPeralatan = {}
    for (const [kategoriId, items] of Object.entries(body)) {
      if (!items || typeof items !== 'object' || Array.isArray(items)) continue
      const row: Record<string, number> = {}
      for (const [peralatanId, qty] of Object.entries(items as Record<string, unknown>)) {
        const value = Number(qty)
        if (Number.isFinite(value) && value > 0) row[peralatanId] = value
      }
      clean[kategoriId] = row
    }
    await saveKomposisiPeralatan(clean)
    await createAuditLog({ aksi: 'UPDATE_KOMPOSISI_PERALATAN', target_type: 'peralatan_komposisi', data_baru: clean })
    return NextResponse.json(clean)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
