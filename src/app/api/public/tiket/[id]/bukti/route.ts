import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyRef } from '@/lib/link-token'
import { isBuktiUrl } from '@/lib/bukti'
import { kirimNotifMenungguVerifikasi } from '@/lib/notifikasi-tiket'
import { clientIp, rateLimit } from '@/lib/rate-limit'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!rateLimit(`tiket-bukti:${clientIp(request.headers)}`, 20, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Terlalu banyak permintaan. Coba lagi nanti.' }, { status: 429 })
    }
    const { id } = await params
    const body = await request.json()
    const buktiUrl = String(body.bukti_url ?? '').trim()
    const t = typeof body.t === 'string' ? body.t : null

    const { data: pesanan, error } = await supabaseAdmin
      .from('pesanan_tiket')
      .select('id,no_pesanan,status,tiket_tipe_id')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!pesanan) return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
    if (!verifyRef('tiket', pesanan.no_pesanan, t)) {
      return NextResponse.json({ error: 'Link tidak valid' }, { status: 403 })
    }
    if (pesanan.status === 'lunas') {
      return NextResponse.json({ error: 'Pesanan sudah lunas' }, { status: 400 })
    }
    if (!isBuktiUrl(buktiUrl)) {
      return NextResponse.json({ error: 'Bukti pembayaran tidak valid' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('pesanan_tiket')
      .update({ bukti_url: buktiUrl, status: 'menunggu_verifikasi', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id,no_pesanan,nama_pembeli,kontak,jumlah,total,tiket_tipe_id')
      .single()
    if (updateError) throw updateError

    try {
      const { data: tipe } = await supabaseAdmin
        .from('tiket_tipe')
        .select('nama')
        .eq('id', updated.tiket_tipe_id)
        .maybeSingle()
      await kirimNotifMenungguVerifikasi(request, updated, tipe?.nama || 'Tiket')
    } catch (err) {
      console.error('Gagal mengirim notifikasi WhatsApp:', err)
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
