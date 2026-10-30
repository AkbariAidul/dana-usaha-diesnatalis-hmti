import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type Promo = {
  id: string
  kode: string
  deskripsi: string
  diskon: number
  kuota: number
  terpakai: number
  aktif: boolean
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('promo_diskon')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    const transformed = (data ?? []).map(item => ({
      id: item.id,
      kode: item.kode,
      deskripsi: item.deskripsi || '',
      diskon: Number(item.diskon),
      kuota: Number(item.kuota),
      terpakai: Number(item.terpakai || 0),
      aktif: item.aktif || false,
    }))
    
    return NextResponse.json(transformed)
  } catch (err: unknown) {
    console.error('Promo error:', err)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const { data, error } = await supabaseAdmin
      .from('promo_diskon')
      .insert({
        kode: body.kode,
        deskripsi: body.deskripsi,
        diskon: body.diskon || 0,
        kuota: body.kuota || 10,
        aktif: true,
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
    const { id, aktif } = body
    
    const { data, error } = await supabaseAdmin
      .from('promo_diskon')
      .update({ aktif })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}