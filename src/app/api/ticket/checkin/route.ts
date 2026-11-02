import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { findUserByPIN } from '@/lib/auth'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('tiket_issued')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10000)

    if (error) throw error

    const rows = data ?? []
    const groups = new Map<string, { id: string; kode_tampil: string }[]>()
    for (const item of rows) {
      const list = groups.get(item.pesanan_id) ?? []
      list.push({ id: item.id, kode_tampil: item.kode_tampil })
      groups.set(item.pesanan_id, list)
    }
    for (const list of groups.values()) {
      list.sort((a, b) => String(a.kode_tampil).localeCompare(String(b.kode_tampil)))
    }

    const transformed = rows.map(item => {
      const list = groups.get(item.pesanan_id) ?? []
      return {
        id: item.id,
        pesanan_id: item.pesanan_id,
        kode_qr: item.kode_qr,
        kode_tampil: item.kode_tampil,
        status: item.status || 'belum_divalidasi',
        nomor: list.findIndex((x) => x.id === item.id) + 1,
        total: list.length,
        digunakan_oleh: item.digunakan_oleh
          ? findUserByPIN(String(item.digunakan_oleh))?.name ?? item.digunakan_oleh
          : null,
        digunakan_pada: item.digunakan_pada,
      }
    })

    return NextResponse.json(transformed)
  } catch (err: unknown) {
    console.error('Checkin error:', err)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, dicatat_oleh } = body
    
    const { data, error } = await supabaseAdmin
      .from('tiket_issued')
      .update({
        status: 'terpakai',
        digunakan_oleh: dicatat_oleh || 'Admin',
        digunakan_pada: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    
    // Log check-in
    await supabaseAdmin.from('checkin_log').insert({
      tiket_issued_id: id,
      kode_qr: data?.kode_qr,
      aksi: 'checkin',
      dicatat_oleh: dicatat_oleh || 'Admin',
    })
    
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}