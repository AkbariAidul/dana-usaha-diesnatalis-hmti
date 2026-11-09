import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyRef } from '@/lib/link-token'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const kode = String(body.kode ?? '').trim().toUpperCase()
    const t = body.t as string | null
    const buktiUrl = String(body.bukti_url ?? '').trim()
    if (!verifyRef('bundle', kode, t)) {
      return NextResponse.json({ error: 'Link tidak valid' }, { status: 403 })
    }
    if (!buktiUrl) {
      return NextResponse.json({ error: 'Bukti pembayaran wajib diupload' }, { status: 400 })
    }

    const { data: order } = await supabaseAdmin
      .from('bundle_order')
      .select('id,status')
      .eq('no_pesanan', kode)
      .maybeSingle()
    if (!order) return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
    if (order.status === 'lunas') {
      return NextResponse.json({ error: 'Pesanan sudah lunas' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('bundle_order')
      .update({ bukti_url: buktiUrl, status: 'menunggu_verifikasi', updated_at: new Date().toISOString() })
      .eq('id', order.id)
    if (error) throw error

    return NextResponse.json({ success: true, message: 'Bukti terkirim, menunggu verifikasi admin' })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
