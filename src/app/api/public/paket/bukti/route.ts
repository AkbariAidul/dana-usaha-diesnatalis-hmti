import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { signRef, verifyRef } from '@/lib/link-token'
import { baseUrl, kirimWhatsApp } from '@/lib/notifikasi-tiket'
import { isBuktiUrl } from '@/lib/bukti'
import { clientIp, rateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    if (!rateLimit(`paket-bukti:${clientIp(request.headers)}`, 20, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Terlalu banyak permintaan. Coba lagi nanti.' }, { status: 429 })
    }
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
    if (!isBuktiUrl(buktiUrl)) {
      return NextResponse.json({ error: 'Bukti pembayaran tidak valid' }, { status: 400 })
    }

    const { data: order } = await supabaseAdmin
      .from('bundle_order')
      .select('id,status,no_pesanan,nama_pembeli,kontak,total')
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

    try {
      const link = `${baseUrl(request)}/lacak/${encodeURIComponent(order.no_pesanan)}?t=${encodeURIComponent(signRef('bundle', order.no_pesanan))}`
      const message = [
        `Halo ${order.nama_pembeli}, bukti pembayaran paket combo kamu sudah kami terima.`,
        '',
        `Kode pesanan: ${order.no_pesanan}`,
        `Total: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(order.total))}`,
        '',
        'Status: Menunggu verifikasi admin.',
        '',
        `Riwayat & struk: ${link}`,
        '',
        'Hormat Kami,',
        'Panitia Danus In4Days XI',
      ].join('\n')
      await kirimWhatsApp(order.kontak, message)
    } catch (notifError) {
      console.error('Notifikasi paket gagal:', notifError)
    }

    return NextResponse.json({ success: true, message: 'Bukti terkirim, menunggu verifikasi admin' })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
