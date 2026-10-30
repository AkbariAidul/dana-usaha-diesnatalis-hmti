import { NextResponse } from 'next/server'
import { getKategoriSewa, getHargaDasar, getFaktorHarga } from '@/lib/queries'

export async function GET() {
  try {
    const [kategori, hargaDasar, faktor] = await Promise.all([
      getKategoriSewa(),
      getHargaDasar(),
      getFaktorHarga(),
    ])
    return NextResponse.json({ kategori, hargaDasar, faktor })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
