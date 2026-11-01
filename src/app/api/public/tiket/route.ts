import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTicketKatalog } from '@/lib/queries'
import { signRef } from '@/lib/link-token'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.nama_pembeli || !body.kontak) throw new Error('Nama dan kontak wajib diisi')

    const tipe = (await getTicketKatalog()).find((t) => t.id === body.tiket_tipe_id)
    if (!tipe) throw new Error('Tipe tiket tidak ditemukan')
    if (!tipe.buka) throw new Error('Tiket sedang ditutup atau sudah habis')

    const jumlah = Math.max(1, Math.floor(Number(body.jumlah || 1)))
    // ponytail: check-then-insert race; use a DB function/constraint if event-day oversell matters
    if (tipe.sisa !== null && jumlah > tipe.sisa) throw new Error(`Sisa tiket ${tipe.sisa}`)

    const harga = Number(tipe.harga_aktif)
    const total = harga * jumlah
    const existing = await supabaseAdmin.from('pesanan_tiket').select('no_pesanan')
    const max = (existing.data||[]).reduce((m:number,p:{ no_pesanan: string })=>{const n=Number(/(\d+)$/.exec(p.no_pesanan)?.[1]??0);return n>m?n:m},0)
    const no = `TK-${String(max+1).padStart(4,'0')}`
    const { data, error } = await supabaseAdmin.from('pesanan_tiket').insert({ no_pesanan:no, nama_pembeli:body.nama_pembeli, kontak:body.kontak, email:body.email||null, tiket_tipe_id:body.tiket_tipe_id, jumlah, harga_satuan:harga, total, status:'menunggu_verifikasi' }).select().single()
    if (error) throw error
    return NextResponse.json({ ...data, t: signRef('tiket', data.no_pesanan) }, { status: 201 })
  } catch(err:unknown){ return NextResponse.json({error:String(err)},{status:500}) }
}
