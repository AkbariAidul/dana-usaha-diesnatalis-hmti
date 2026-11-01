import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { signRef } from '@/lib/link-token'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const tipe = body.tipe_pemesan === 'Pengurus Himpunan' ? 'Pengurus Himpunan' : 'Umum'
    const qty = Math.max(1, Math.min(20, Number(body.qty) || 1))
    const varianId = String(body.varian_id ?? '')
    if (!varianId) return NextResponse.json({ error: 'Ukuran wajib dipilih' }, { status: 400 })

    const [{ data: varian }, { data: hargaSetting }] = await Promise.all([
      supabaseAdmin.from('merch_varian').select('*').eq('id', varianId).eq('aktif', true).maybeSingle(),
      supabaseAdmin.from('pengaturan_umum').select('value').eq('key', 'po_harga').maybeSingle(),
    ])
    if (!varian) return NextResponse.json({ error: 'Ukuran tidak tersedia' }, { status: 400 })

    let nama = String(body.nama_pemesan ?? '').trim()
    let kontak = String(body.kontak ?? '').trim()
    let pengurusId: string | null = null
    const email = body.email ? String(body.email).trim() : null

    if (tipe === 'Pengurus Himpunan') {
      pengurusId = String(body.pengurus_id ?? '')
      const { data: pengurus } = await supabaseAdmin
        .from('pengurus')
        .select('id,nama,kontak')
        .eq('id', pengurusId)
        .eq('aktif', true)
        .maybeSingle()
      if (!pengurus) return NextResponse.json({ error: 'Pilih nama pengurus yang valid' }, { status: 400 })
      nama = pengurus.nama
      kontak = kontak || pengurus.kontak || ''
    }

    if (!nama || !kontak) {
      return NextResponse.json({ error: 'Nama dan kontak wajib diisi' }, { status: 400 })
    }

    const harga = Number(hargaSetting?.value ?? 75000)
    const total = harga * qty

    const { data: existing } = await supabaseAdmin.from('merch_po').select('no_po')
    const max = (existing ?? []).reduce((m, p) => {
      const n = Number(/(\d+)$/.exec(p.no_po)?.[1] ?? 0)
      return n > m ? n : m
    }, 0)
    const noPo = `PO-${String(max + 1).padStart(4, '0')}`

    const { data: po, error } = await supabaseAdmin
      .from('merch_po')
      .insert({
        no_po: noPo,
        nama_pemesan: nama,
        kontak,
        email,
        tipe_pemesan: tipe,
        pengurus_id: pengurusId,
        harga_per_item: harga,
        total,
        sudah_dibayar: 0,
        status: 'menunggu_verifikasi',
      })
      .select()
      .single()
    if (error) throw error

    const { error: itemError } = await supabaseAdmin.from('merch_po_item').insert({
      po_id: po.id,
      varian_id: varian.id,
      ukuran: varian.nama,
      qty,
      harga_satuan: harga,
      subtotal: total,
    })
    if (itemError) {
      await supabaseAdmin.from('merch_po').delete().eq('id', po.id)
      throw itemError
    }

    return NextResponse.json({
      id: po.id,
      no_po: po.no_po,
      total: po.total,
      t: signRef('po', po.no_po),
    }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
