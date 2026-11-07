import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hitungTerjual } from '@/lib/merch-po'
import { signRef } from '@/lib/link-token'
import { hitungDiskon } from '@/lib/merch-diskon'
import { turnstileFailure, verifyTurnstile } from '@/lib/turnstile'

type ItemBody = {
  merchandise_id: string
  varian_id?: string
  qty?: number
}
type Varian = { id: string; nama: string }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const tipe = body.tipe_pemesan === 'Pengurus Himpunan' ? 'Pengurus Himpunan' : 'Umum'
    const items: ItemBody[] = Array.isArray(body.items) ? body.items : []
    if (items.length === 0) {
      return NextResponse.json({ error: 'Pilih minimal satu produk' }, { status: 400 })
    }

    let nama = String(body.nama_pemesan ?? '').trim()
    let kontak = String(body.kontak ?? '').trim()
    let pengurusId: string | null = null
    const email = body.email ? String(body.email).trim() : null
    const pembayaranMetode = tipe === 'Pengurus Himpunan' && body.pembayaran_metode === 'Cash' ? 'Cash' : 'QRIS'
    const pembayaranTipe = tipe === 'Pengurus Himpunan' && body.pembayaran_tipe === 'nyicil' ? 'nyicil' : 'lunas'

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

    const validatedItems: Array<{ produk: { id: string; nama: string; harga_po: number; gambar_url: string | null; po_unlimited: boolean; po_stok: number; diskon?: unknown; varian_ids?: string[] | null }; qty: number; varian?: Varian | null; subtotal: number; diskon: number }> = []
    let total = 0

    for (const item of items) {
      const merchandiseId = String(item.merchandise_id ?? '')
      const qty = Math.max(1, Math.min(20, Number(item.qty) || 1))
      const varianId = item.varian_id ? String(item.varian_id) : ''

      if (!merchandiseId) {
        return NextResponse.json({ error: 'Produk wajib dipilih' }, { status: 400 })
      }

      const { data: produk } = await supabaseAdmin
        .from('merchandise')
        .select('*')
        .eq('id', merchandiseId)
        .eq('aktif', true)
        .maybeSingle()
      if (!produk) {
        return NextResponse.json({ error: 'Produk tidak tersedia' }, { status: 400 })
      }
      if (!produk.harga_po) {
        return NextResponse.json({ error: 'Pre-order produk ini belum dibuka' }, { status: 400 })
      }

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
        if (qty > sisa) {
          return NextResponse.json({ error: `Slot pre-order tidak cukup untuk ${produk.nama}` }, { status: 400 })
        }
      }

      const varianTersedia = Array.isArray(produk.varian_ids) ? produk.varian_ids.map(String) : []
      if (varianTersedia.length > 0 && !varianId) {
        return NextResponse.json({ error: `Pilih ukuran untuk ${produk.nama}` }, { status: 400 })
      }
      if (varianId && !varianTersedia.includes(varianId)) {
        return NextResponse.json({ error: `Ukuran tidak tersedia untuk ${produk.nama}` }, { status: 400 })
      }

      let varian: { id: string; nama: string } | null = null
      if (varianId) {
        const { data } = await supabaseAdmin
          .from('merch_varian')
          .select('*')
          .eq('id', varianId)
          .eq('aktif', true)
          .maybeSingle()
        if (!data) {
          return NextResponse.json({ error: 'Ukuran tidak tersedia' }, { status: 400 })
        }
        varian = data
      }

      const harga = Number(produk.harga_po)
      const hitung = hitungDiskon(qty, harga, produk.diskon, 'po')
      total += hitung.total
      validatedItems.push({ produk, qty, varian, subtotal: hitung.total, diskon: hitung.diskon })
    }

    const { data: existing } = await supabaseAdmin.from('merch_po').select('no_po')
    const max = (existing ?? []).reduce((m, p) => {
      const n = Number(/(\d+)$/.exec(p.no_po)?.[1] ?? 0)
      return n > m ? n : m
    }, 0)
    const noPo = `PO-${String(max + 1).padStart(4, '0')}`

    const turnstile = await verifyTurnstile(body.turnstile_token, request.headers)
    if (!turnstile.ok) {
      const failure = turnstileFailure(turnstile.reason)
      return NextResponse.json({ error: failure.error }, { status: failure.status })
    }

    const { data: po, error } = await supabaseAdmin
      .from('merch_po')
      .insert({
        no_po: noPo,
        nama_pemesan: nama,
        kontak,
        email,
        tipe_pemesan: tipe,
        pengurus_id: pengurusId,
        harga_per_item: 0,
        total,
        sudah_dibayar: 0,
        status: 'menunggu_verifikasi',
        pembayaran_metode: pembayaranMetode,
        pembayaran_tipe: pembayaranTipe,
      })
      .select()
      .single()
    if (error) throw error

    const insertItems = validatedItems.map((v) => ({
      po_id: po.id,
      merchandise_id: v.produk.id,
      varian_id: v.varian?.id ?? null,
      ukuran: v.varian?.nama ?? null,
      qty: v.qty,
      harga_satuan: Number(v.produk.harga_po),
      diskon: v.diskon,
      subtotal: v.subtotal,
    }))

    const { error: itemError } = await supabaseAdmin.from('merch_po_item').insert(insertItems)
    if (itemError) {
      await supabaseAdmin.from('merch_po').delete().eq('id', po.id)
      throw itemError
    }

    return NextResponse.json({
      id: po.id,
      no_po: po.no_po,
      total: po.total,
      items: validatedItems.map((v) => ({
        produk: { nama: v.produk.nama, gambar_url: v.produk.gambar_url },
        qty: v.qty,
        varian: v.varian ? { nama: v.varian.nama } : null,
      })),
      t: signRef('po', po.no_po),
    }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
