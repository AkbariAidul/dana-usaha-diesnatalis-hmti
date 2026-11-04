import { NextResponse } from 'next/server'
import { getStrukTiket } from '@/lib/queries'
import { linkTiket } from '@/lib/notifikasi-tiket'
import { buatStrukTiketPdf, namaFileStruk } from '@/lib/struk-po'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const kode = String(new URL(request.url).searchParams.get('kode') ?? '').trim().toUpperCase()
    if (!kode) return NextResponse.json({ error: 'Kode pesanan wajib diisi' }, { status: 400 })

    const pesanan = await getStrukTiket(kode)
    if (!pesanan) return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })

    const buffer = await buatStrukTiketPdf(pesanan, linkTiket(request, pesanan.no_pesanan))
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${namaFileStruk(pesanan.no_pesanan)}"`,
      },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
