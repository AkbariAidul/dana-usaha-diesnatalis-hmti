import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hitungTerjual } from '@/lib/merch-po'

export async function GET() {
  try {
    const [pengurus, varian, produk] = await Promise.all([
      supabaseAdmin.from('pengurus').select('id,nama,divisi,kontak').eq('aktif', true).order('nama'),
      supabaseAdmin.from('merch_varian').select('*').eq('aktif', true).order('urutan'),
      supabaseAdmin
        .from('merchandise')
        .select('id,nama,deskripsi,gambar_url,warna,harga,harga_po,harga_po_panjang,harga_po_umum,harga_po_umum_panjang,harga_hari_h_panjang,po_mulai,po_selesai,po_unlimited,po_stok,varian_ids')
        .eq('aktif', true)
        .order('nama'),
    ])

    const now = Date.now()
    const aktif = (produk.data ?? []).filter((item) =>
      [item.harga_po, item.harga_po_panjang, item.harga_po_umum, item.harga_po_umum_panjang]
        .some((harga) => Number(harga) > 0),
    )

    const terjual = await hitungTerjual(aktif.map((item) => item.id as string))
    const items = aktif.map((item) => {
      const total = terjual.get(item.id) ?? 0
      const sisa = item.po_unlimited ? null : Math.max(0, Number(item.po_stok) - total)
      const mulai = item.po_mulai ? new Date(item.po_mulai).getTime() : NaN
      const selesai = item.po_selesai ? new Date(item.po_selesai).getTime() : NaN
      const po_buka = Number.isFinite(mulai) && Number.isFinite(selesai) && now >= mulai && now <= selesai
      return {
        ...item,
        harga: Number(item.harga ?? 0),
        harga_po: Number(item.harga_po ?? 0),
        harga_po_panjang: Number(item.harga_po_panjang ?? 0),
        harga_po_umum: Number(item.harga_po_umum ?? 0),
        harga_po_umum_panjang: Number(item.harga_po_umum_panjang ?? 0),
        harga_hari_h_panjang: Number(item.harga_hari_h_panjang ?? 0),
        po_stok: Number(item.po_stok),
        terjual: total,
        sisa,
        po_buka,
      }
    })

    return NextResponse.json({
      pengurus: pengurus.data ?? [],
      varian: varian.data ?? [],
      items,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
