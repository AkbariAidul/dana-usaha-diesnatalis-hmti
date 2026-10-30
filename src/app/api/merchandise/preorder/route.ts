import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type PreOrder = {
  id: string
  nama_pemesan: string
  kontak: string
  produk: string
  qty: number
  size: string
  total: number
  status: 'menunggu' | 'dikonfirmasi' | 'diproduksi' | 'selesai' | 'dibatalkan'
  catatan: string | null
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('merch_po')
      .select(`
        id,
        no_po,
        nama_pemesan,
        kontak,
        tipe_pemesan,
        harga_per_item,
        total,
        sudah_dibayar,
        status,
        created_at
      `)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    // Transform to match frontend expected format
    const transformed = (data ?? []).map(item => ({
      id: item.id,
      nama_pemesan: item.nama_pemesan,
      kontak: item.kontak,
      produk: `PO ${item.no_po}`,
      qty: 1,
      size: '-',
      total: Number(item.total),
      status: item.status === 'menunggu_verifikasi' ? 'menunggu' : 
              item.status === 'dp_diterima' ? 'dikonfirmasi' :
              item.status === 'lunas' ? 'selesai' : item.status,
       catatan: (item as Record<string, unknown>).catatan_admin as string | null || null,
      created_at: item.created_at?.split('T')[0],
    }))
    
    return NextResponse.json(transformed)
  } catch (err: unknown) {
    console.error('PreOrder error:', err)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Generate PO number
    const { data: existingData } = await supabaseAdmin
      .from('merch_po')
      .select('no_po')
    
    const maxNum = ((existingData as Record<string, unknown>[] ?? []) as { no_po: string }[]).reduce((m: number, p: { no_po: string }) => {
      const n = Number(/(\d+)$/.exec(p.no_po)?.[1] ?? 0)
      return n > m ? n : m
    }, 0)
    const noPo = `PO-${String(maxNum + 1).padStart(4, '0')}`
    
    const { data, error } = await supabaseAdmin
      .from('merch_po')
      .insert({
        no_po: noPo,
        nama_pemesan: body.nama_pemesan,
        kontak: body.kontak,
        tipe_pemesan: body.tipe_pemesan || 'Umum',
        harga_per_item: body.harga_per_item || 75000,
        total: body.total || 75000,
        status: 'menunggu_verifikasi',
      })
      .select()
      .single()
    
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, status } = body
    
    const { data, error } = await supabaseAdmin
      .from('merch_po')
      .update({ status })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}