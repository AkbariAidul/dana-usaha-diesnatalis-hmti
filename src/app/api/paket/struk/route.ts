import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { signRef } from '@/lib/link-token'
import { baseUrl } from '@/lib/notifikasi-tiket'
import { buatStrukBundlePdf, namaFileStruk } from '@/lib/struk-po'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const kode = String(new URL(request.url).searchParams.get('kode') ?? '').trim().toUpperCase()
    if (!kode) return NextResponse.json({ error: 'Kode pesanan wajib diisi' }, { status: 400 })

    const { data: order } = await supabaseAdmin.from('bundle_order').select('*').eq('no_pesanan', kode).maybeSingle()
    if (!order) return NextResponse.json({ error: 'Pesanan paket tidak ditemukan' }, { status: 404 })

    const [{ data: items }, { data: bundle }] = await Promise.all([
      supabaseAdmin.from('bundle_order_item').select('*').eq('bundle_order_id', order.id),
      order.bundle_id
        ? supabaseAdmin.from('bundle').select('nama').eq('id', order.bundle_id).maybeSingle()
        : Promise.resolve({ data: null as { nama: string } | null }),
    ])

    const qrUrl = `${baseUrl(request)}/lacak/${encodeURIComponent(kode)}?t=${encodeURIComponent(signRef('bundle', kode))}`
    const buffer = await buatStrukBundlePdf(
      { ...order, bundle_nama: bundle?.nama ?? null },
      (items ?? []).map((item) => ({
        nama: item.nama_snapshot,
        detail: [item.warna, item.lengan, item.ukuran].filter(Boolean).join(' · ') || null,
        qty: Number(item.qty),
        harga_satuan: Number(item.harga_satuan),
        subtotal: Number(item.subtotal),
      })),
      qrUrl
    )

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${namaFileStruk(order.no_pesanan)}"`,
      },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
