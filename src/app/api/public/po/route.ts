import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hitungTerjual } from '@/lib/merch-po'
import { signRef } from '@/lib/link-token'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const tipe = body.tipe_pemesan === 'Pengurus Himpunan' ? 'Pengurus Himpunan' : 'Umum'
    const qty = Math.max(1, Math.min(20, Number(body.qty) || 1))
    const merchandiseId = String(body.merchandise_id ?? '')
    const varianId = body.varian_id ? String(body.varian_id) : ''

    if (!merchandiseId) return NextResponse.json({ error: 'Produk wajib dipilih' }, { status: 400 })

    const { data: produk } = await supabaseAdmin
      .from('merchandise')
      .select('*')
      .eq('id', merchandiseId)
      .eq('aktif', true)
      .maybeSingle()
    if (!produk) return NextResponse.json({ error: 'Produk tidak tersedia' }, { status: 400 })
    if (!produk.harga_po) return NextResponse.json({ error: 'Pre-order produk ini belum dibuka' }, { status: 400 })

    const now = Date.now()
    const mulai = new Date(produk.po_mulai).getTime()
    const selesai = new Date(produk.po_selesai).getTime()
    if (!Number.isFinite(mulai) || !Number.isFinite(selesai) || now < mulai || now > selesai) {
      return NextResponse.json({ error: 'Periode pre-order sudah berakhir atau belum dimulai' }, { status: 400 })
    }

    // ponytail: slot check is not atomic; use an RPC if limited slots get traffic spikes.
    if (!produk.po_unlimited) {
      const terjual = await hitungTerjual([produk.id])
      const sisa = Number(produk.po_stok) - (terjual.get(produk.id) ?? 0)
      if (qty > sisa) return NextResponse.json({ error: 'Slot pre-order tidak cukup' }, { status: 400 })
    }

    let varian: { id: string; nama: string } | null = null
    if (varianId) {
      const { data } = await supabaseAdmin
        .from('merch_varian')
        .select('*')
        .eq('id', varianId)
        .eq('aktif', true)
        .maybeSingle()
      if (!data) return NextResponse.json({ error: 'Ukuran tidak tersedia' }, { status: 400 })
      varian = data
    }

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

    const harga = Number(produk.harga_po)
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
      merchandise_id: produk.id,
      varian_id: varian?.id ?? null,
      ukuran: varian?.nama ?? null,
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
      produk: { nama: produk.nama, gambar_url: produk.gambar_url },
      t: signRef('po', po.no_po),
    }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
