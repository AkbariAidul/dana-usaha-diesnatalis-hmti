import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type KuotaItem = {
  id: string
  nama_lokasi: string
  total: number
  terisi: number
  sisa: number
  koordinat: string
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('kuota_stand')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    console.error('Kuota error:', err)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const { data, error } = await supabaseAdmin
      .from('kuota_stand')
      .insert({
        nama_lokasi: body.nama_lokasi,
        total: body.total || 5,
        terisi: 0,
        sisa: body.total || 5,
        koordinat: body.koordinat || null,
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
    const { id, terisi } = await request.json()
    const { data, error } = await supabaseAdmin
      .from('kuota_stand')
      .update({ terisi, sisa: (await request.json()).total - terisi })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}