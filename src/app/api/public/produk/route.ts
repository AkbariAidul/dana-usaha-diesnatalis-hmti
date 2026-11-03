import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: produk } = await supabaseAdmin
      .from('merchandise')
      .select('id,nama,deskripsi,gambar_url,warna,harga,harga_po,po_mulai,po_selesai,po_unlimited,po_stok,aktif')
      .eq('aktif', true)
      .order('nama')

    return NextResponse.json(produk ?? [])
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
