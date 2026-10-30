import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type Peralatan = {
  id: string
  nama: string
  jenis: string
  jumlah: number
  status: 'tersedia' | 'dipinjam' | 'rusak'
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('peralatan')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    console.error('Peratan error:', err)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const { data, error } = await supabaseAdmin
      .from('peralatan')
      .insert({
        nama: body.nama,
        jenis: body.jenis || 'Tenda',
        jumlah: body.jumlah || 1,
        status: 'tersedia' as const,
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
    const { id, status } = await request.json()
    const { data, error } = await supabaseAdmin
      .from('peralatan')
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

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    await supabaseAdmin.from('peralatan').delete().eq('id', id)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}