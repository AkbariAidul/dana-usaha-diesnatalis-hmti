import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { kirimNotifMenungguVerifikasi } from '@/lib/notifikasi-tiket'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { data: pesanan, error } = await supabaseAdmin
      .from('pesanan_tiket')
      .update({ bukti_url: body.bukti_url, status: 'menunggu_verifikasi' })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    try {
      const { data: tipe } = await supabaseAdmin
        .from('tiket_tipe')
        .select('nama')
        .eq('id', pesanan.tiket_tipe_id)
        .maybeSingle()
      await kirimNotifMenungguVerifikasi(request, pesanan, tipe?.nama || 'Tiket')
    } catch (err) {
      console.error('Gagal mengirim notifikasi WhatsApp:', err)
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
