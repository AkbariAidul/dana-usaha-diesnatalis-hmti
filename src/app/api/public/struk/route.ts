import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { tipeDariKode, verifyRef } from '@/lib/link-token'
import { buatStrukPoXlsx, namaFileStruk } from '@/lib/struk-po'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const kode = String(url.searchParams.get('kode') ?? '').trim().toUpperCase()
    const t = url.searchParams.get('t')
    if (tipeDariKode(kode) !== 'po' || !verifyRef('po', kode, t)) {
      return NextResponse.json({ error: 'Link tidak valid' }, { status: 403 })
    }

    const { data: po } = await supabaseAdmin.from('merch_po').select('*').eq('no_po', kode).maybeSingle()
    if (!po) return NextResponse.json({ error: 'PO tidak ditemukan' }, { status: 404 })

    const [{ data: items }, { data: varian }, { data: merchandise }] = await Promise.all([
      supabaseAdmin.from('merch_po_item').select('*').eq('po_id', po.id),
      supabaseAdmin.from('merch_varian').select('id,nama'),
      supabaseAdmin.from('merchandise').select('id,nama'),
    ])
    const varianMap = new Map((varian ?? []).map((v) => [v.id, v.nama]))
    const merchandiseMap = new Map((merchandise ?? []).map((m) => [m.id, m.nama]))

    const buffer = await buatStrukPoXlsx(
      po,
      (items ?? []).map((item) => ({
        nama: merchandiseMap.get(item.merchandise_id) ?? 'Merchandise',
        ukuran: item.varian_id ? varianMap.get(item.varian_id) ?? item.ukuran : item.ukuran,
        qty: Number(item.qty),
        harga_satuan: Number(item.harga_satuan),
        subtotal: Number(item.subtotal),
      }))
    )

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${namaFileStruk(po.no_po)}"`,
      },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
