import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTicketKatalog } from '@/lib/queries'
import { signRef } from '@/lib/link-token'
import { turnstileFailure, verifyTurnstile } from '@/lib/turnstile'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.nama_pembeli || !body.kontak) throw new Error('Nama dan kontak wajib diisi')

    const tipe = (await getTicketKatalog()).find((t) => t.id === body.tiket_tipe_id)
    if (!tipe) throw new Error('Tipe tiket tidak ditemukan')
    if (!tipe.buka) throw new Error('Tiket sedang ditutup atau sudah habis')

    const jumlah = Math.max(1, Math.floor(Number(body.jumlah || 1)))
    if (tipe.sisa !== null && jumlah > tipe.sisa) throw new Error(`Sisa tiket ${tipe.sisa}`)

    // Apply bundle discount if quantity matches exactly
    const hargaSatuan = Number(tipe.harga_aktif)
    const bundle = tipe.bundle_discounts.find((b) => Number(b.jumlah_min) === jumlah)
    const diskon = bundle ? Number(bundle.diskon_persen) : 0
    const subtotal = hargaSatuan * jumlah
    const total = Math.round(subtotal * (1 - diskon / 100))

    const existing = await supabaseAdmin.from('pesanan_tiket').select('no_pesanan')
    const max = (existing.data||[]).reduce((m:number,p:{ no_pesanan: string })=>{const n=Number(/(\d+)$/.exec(p.no_pesanan)?.[1]??0);return n>m?n:m},0)
    const no = `TK-${String(max+1).padStart(4,'0')}`
    const turnstile = await verifyTurnstile(body.turnstile_token, request.headers)
    if (!turnstile.ok) {
      const failure = turnstileFailure(turnstile.reason)
      return NextResponse.json({ error: failure.error }, { status: failure.status })
    }
    const { data, error } = await supabaseAdmin.from('pesanan_tiket').insert({
      no_pesanan: no,
      nama_pembeli: body.nama_pembeli,
      kontak: body.kontak,
      email: body.email || null,
      tiket_tipe_id: body.tiket_tipe_id,
      jumlah,
      harga_satuan: hargaSatuan,
      diskon_persen: diskon,
      total,
      status: 'menunggu_verifikasi',
    }).select().single()
    if (error) throw error
    return NextResponse.json({ ...data, t: signRef('tiket', data.no_pesanan) }, { status: 201 })
  } catch(err:unknown){ return NextResponse.json({error:String(err)},{status:500}) }
}
