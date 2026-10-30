import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type KasirTransaksi = {
  id: string
  tanggal: string
  produk: string
  qty: number
  total: number
  metode: string
  dicatat_oleh: string
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('kasir_transaksi')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (error) throw error
    
    const transformed = (data ?? []).map(item => ({
      id: item.id,
      tanggal: item.created_at || new Date().toISOString(),
      produk: item.produk_nama || item.produk || '-',
      qty: Number(item.qty),
      total: Number(item.total),
      metode: item.metode || 'Tunai',
      dicatat_oleh: item.dicatat_oleh || 'Admin',
    }))
    
    return NextResponse.json(transformed)
  } catch (err: unknown) {
    console.error('Kasir error:', err)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const { data, error } = await supabaseAdmin
      .from('kasir_transaksi')
      .insert({
        produk: body.produk,
        qty: body.qty || 1,
        total: body.total || (body.qty || 1) * 75000,
        metode: body.metode || 'Tunai',
        dicatat_oleh: body.dicatat_oleh || 'Admin',
      })
      .select()
      .single()
    
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}