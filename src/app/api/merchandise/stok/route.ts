import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type StokLog = {
  id: string
  produk: string
  jenis: 'masuk' | 'keluar'
  qty: number
  tanggal: string
  keterangan: string | null
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('stok_log')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    const transformed = (data ?? []).map(item => ({
      id: item.id,
      produk: item.produk_nama || item.produk,
      jenis: item.jenis || 'masuk',
      qty: Number(item.qty),
      tanggal: item.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      keterangan: item.keterangan,
    }))
    
    return NextResponse.json(transformed)
  } catch (err: unknown) {
    console.error('Stok error:', err)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const { data, error } = await supabaseAdmin
      .from('stok_log')
      .insert({
        produk: body.produk,
        jenis: body.jenis || 'masuk',
        qty: body.qty || 1,
        keterangan: body.keterangan || null,
      })
      .select()
      .single()
    
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}