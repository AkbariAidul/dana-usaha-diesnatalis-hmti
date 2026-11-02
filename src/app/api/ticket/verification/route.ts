import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { kirimNotifTerverifikasi } from '@/lib/notifikasi-tiket'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, status, catatan_admin } = body

    const { data: sebelum } = await supabaseAdmin
      .from('pesanan_tiket')
      .select('status')
      .eq('id', id)
      .maybeSingle()

    const { data, error } = await supabaseAdmin
      .from('pesanan_tiket')
      .update({
        status,
        catatan_admin,
        verified_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // If approved, create ticket issued (idempotent)
    if (status === 'lunas') {
      const { data: existing } = await supabaseAdmin
        .from('tiket_issued')
        .select('id')
        .eq('pesanan_id', id)
        .limit(1)

      if (!existing?.length) {
        // Get the ticket tipe to generate QR
        const { data: tipeData } = await supabaseAdmin
          .from('tiket_tipe')
          .select('kuota,terjual')
          .eq('id', data.tiket_tipe_id)
          .single()

        // Update kuota
        if (tipeData) {
          await supabaseAdmin
            .from('tiket_tipe')
            .update({ terjual: Number(tipeData.terjual ?? 0) + Number(data.jumlah) })
            .eq('id', data.tiket_tipe_id)
        }

        // Generate QR codes for each ticket
        for (let i = 0; i < data.jumlah; i++) {
          const kodeTampil = `DN2026-${String(Date.now()).slice(-6)}-${String(i + 1).padStart(3, '0')}`
          const kodeQr = crypto.randomUUID().replace(/-/g, '')
          
          await supabaseAdmin.from('tiket_issued').insert({
            pesanan_id: id,
            kode_qr: kodeQr,
            kode_tampil: kodeTampil,
            status: 'belum_divalidasi',
          })
        }
      }
    }

    if (status === 'lunas' && sebelum?.status !== 'lunas') {
      try {
        const { data: tipe } = await supabaseAdmin
          .from('tiket_tipe')
          .select('nama')
          .eq('id', data.tiket_tipe_id)
          .maybeSingle()
        await kirimNotifTerverifikasi(request, data, tipe?.nama || 'Tiket')
      } catch (err) {
        console.error('Gagal mengirim notifikasi WhatsApp:', err)
      }
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}