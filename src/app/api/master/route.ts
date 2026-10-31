import { NextResponse } from 'next/server'
import { getKategoriSewa, getHargaDasar, getFaktorHarga, getPeriodeHarga } from '@/lib/queries'

export async function GET() {
  try {
    const [kategori, hargaDasar, faktor, periode] = await Promise.all([
      getKategoriSewa(),
      getHargaDasar(),
      getFaktorHarga(),
      getPeriodeHarga(),
    ])
    return NextResponse.json({ kategori, hargaDasar, faktor, periode })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
