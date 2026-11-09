import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: produk } = await supabaseAdmin
      .from('merchandise')
      .select('id,nama,deskripsi,gambar_url,warna,harga,harga_po,harga_po_panjang,harga_po_umum,harga_po_umum_panjang,harga_hari_h_panjang,po_mulai,po_selesai,po_unlimited,po_stok,aktif,diskon,varian_ids')
      .eq('aktif', true)
      .order('nama')

    return NextResponse.json(produk ?? [])
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
