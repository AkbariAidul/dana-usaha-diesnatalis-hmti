import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { buatStrukPoHtml, namaFileStruk } from '@/lib/struk-po'

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID PO wajib diisi' }, { status: 400 })

    const { data: po } = await supabaseAdmin.from('merch_po').select('*').eq('id', id).maybeSingle()
    if (!po) return NextResponse.json({ error: 'PO tidak ditemukan' }, { status: 404 })

    const [{ data: items }, { data: varian }, { data: merchandise }] = await Promise.all([
      supabaseAdmin.from('merch_po_item').select('*').eq('po_id', id),
      supabaseAdmin.from('merch_varian').select('id,nama'),
      supabaseAdmin.from('merchandise').select('id,nama'),
    ])
    const varianMap = new Map((varian ?? []).map((v) => [v.id, v.nama]))
    const merchandiseMap = new Map((merchandise ?? []).map((m) => [m.id, m.nama]))

    const html = buatStrukPoHtml(
      po,
      (items ?? []).map((item) => ({
        nama: merchandiseMap.get(item.merchandise_id) ?? 'Merchandise',
        ukuran: item.varian_id ? varianMap.get(item.varian_id) ?? item.ukuran : item.ukuran,
        qty: Number(item.qty),
        subtotal: Number(item.subtotal),
      }))
    )

    return new NextResponse(`\ufeff${html}`, {
      headers: {
        'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
        'Content-Disposition': `attachment; filename="${namaFileStruk(po.no_po)}"`,
      },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
