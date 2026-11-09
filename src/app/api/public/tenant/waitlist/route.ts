import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hitungPendaftaran, PendaftaranError, type BodyPendaftaran } from '@/lib/tenant-pendaftaran'
import { turnstileFailure, verifyTurnstile } from '@/lib/turnstile'
import { kirimWhatsApp } from '@/lib/notifikasi-tiket'
import { formatRupiah } from '@/lib/utils'
import { clientIp, rateLimit } from '@/lib/rate-limit'

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return String(err)
}

function waLink(kontak: string) {
  const digits = kontak.replace(/\D/g, '')
  if (!digits) return null
  const nomor = digits.startsWith('0') ? `62${digits.slice(1)}` : digits.startsWith('62') ? digits : `62${digits}`
  return `https://wa.me/${nomor}`
}

export async function POST(request: Request) {
  try {
    if (!rateLimit(`waitlist:${clientIp(request.headers)}`, 5, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Terlalu banyak permintaan. Coba lagi nanti.' }, { status: 429 })
    }
    const body = (await request.json()) as BodyPendaftaran
    const namaUsaha = String(body.nama_usaha ?? '').trim()
    const kontak = String(body.kontak ?? '').trim()
    if (!namaUsaha) return NextResponse.json({ error: 'Nama usaha wajib diisi' }, { status: 400 })
    if (!kontak) return NextResponse.json({ error: 'Kontak wajib diisi' }, { status: 400 })
    if (!body.kategori_sewa_id) return NextResponse.json({ error: 'Paket wajib dipilih' }, { status: 400 })

    let hasil
    try {
      hasil = await hitungPendaftaran(body)
    } catch (err) {
      if (err instanceof PendaftaranError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      throw err
    }

    const turnstile = await verifyTurnstile((body as { turnstile_token?: unknown }).turnstile_token, request.headers)
    if (!turnstile.ok) {
      const failure = turnstileFailure(turnstile.reason)
      return NextResponse.json({ error: failure.error }, { status: failure.status })
    }

    const payload = {
      kategori_sewa_id: body.kategori_sewa_id,
      nama_usaha: namaUsaha,
      kontak,
      email: String(body.email ?? '').trim() || null,
      alamat: String(body.alamat ?? '').trim() || null,
      deskripsi_usaha: String(body.deskripsi_usaha ?? '').trim() || null,
      jumlah_tenant: hasil.jumlahTenant,
      jenis_usaha: hasil.jenisUsaha,
      jenis_usaha_qty: { fnb: hasil.qtyFnb, nonFnb: hasil.qtyNonFnb },
      addon: hasil.addon,
      harga_akhir: hasil.harga,
      status: 'menunggu',
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabaseAdmin
      .from('tenant_waitlist')
      .upsert(payload, { onConflict: 'kategori_sewa_id,kontak' })
      .select()
      .single()
    if (error) throw error

    const link = waLink(kontak)
    const rincianJenis = [
      hasil.qtyFnb > 0 ? `F&B ${hasil.qtyFnb}` : null,
      hasil.qtyNonFnb > 0 ? `Non-F&B ${hasil.qtyNonFnb}` : null,
    ].filter(Boolean).join(' + ')
    const addonLines = hasil.addon.map((a) => `- ${a.nama} x${a.qty} = ${formatRupiah(a.subtotal)}`)
    const pesan = [
      'Daftar tunggu tenant baru masuk.',
      '',
      `Paket: ${hasil.kategori.nama}`,
      `Nama usaha: ${namaUsaha}`,
      `Kontak: ${kontak}${link ? ` (${link})` : ''}`,
      `Jumlah tenant: ${hasil.jumlahTenant}${rincianJenis ? ` (${rincianJenis})` : ''}`,
      `Estimasi harga: ${formatRupiah(hasil.harga)}`,
      ...(addonLines.length ? ['Addon:', ...addonLines] : []),
      '',
      'Buka dashboard TENANT untuk menindaklanjuti.',
    ].join('\n')
    await kirimWhatsApp(process.env.WA_ADMIN_TENANT || '6282354625412', pesan)

    return NextResponse.json(
      { success: true, id: data.id, harga_akhir: hasil.harga, addon: hasil.addon },
      { status: 201 },
    )
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 })
  }
}
