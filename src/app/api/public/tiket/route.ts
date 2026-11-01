import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { signRef } from '@/lib/link-token'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const tipe = await supabaseAdmin.from('tiket_tipe').select('*').eq('id', body.tiket_tipe_id).single()
    if (!tipe.data) throw new Error('Tipe tiket tidak ditemukan')
    const harga = Number((tipe.data as { harga: number }).harga)
    const jumlah = Number(body.jumlah || 1)
    const total = harga * jumlah
    const existing = await supabaseAdmin.from('pesanan_tiket').select('no_pesanan')
    const max = (existing.data||[]).reduce((m:number,p:{ no_pesanan: string })=>{const n=Number(/(\d+)$/.exec(p.no_pesanan)?.[1]??0);return n>m?n:m},0)
    const no = `TK-${String(max+1).padStart(4,'0')}`
    const { data, error } = await supabaseAdmin.from('pesanan_tiket').insert({ no_pesanan:no, nama_pembeli:body.nama_pembeli, kontak:body.kontak, email:body.email||null, tiket_tipe_id:body.tiket_tipe_id, jumlah, harga_satuan:harga, total, status:'menunggu_verifikasi' }).select().single()
    if (error) throw error
    return NextResponse.json({ ...data, t: signRef('tiket', data.no_pesanan) }, { status: 201 })
  } catch(err:unknown){ return NextResponse.json({error:String(err)},{status:500}) }
}
