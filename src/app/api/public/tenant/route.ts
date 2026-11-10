import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { signRef } from '@/lib/link-token'
import { turnstileFailure, verifyTurnstile } from '@/lib/turnstile'
import { hitungPendaftaran, PendaftaranError, type BodyPendaftaran } from '@/lib/tenant-pendaftaran'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { apiError, rpcError } from '@/lib/api-error'
import { normalizeIdempotency } from '@/lib/idempotency'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('pendaftaran_tenant_pub')
      .select('*')
      .neq('status', 'dp_diterima')
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function POST(request: Request) {
  try {
    if (!rateLimit(`tenant:${clientIp(request.headers)}`, 5, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Terlalu banyak permintaan. Coba lagi nanti.' }, { status: 429 })
    }
    const body = (await request.json()) as BodyPendaftaran
    const dataBody: Record<string, unknown> = {}
    for (const key of ['nama_usaha', 'kontak', 'email', 'alamat', 'deskripsi_usaha', 'kategori_sewa_id', 'jenis_usaha']) {
      if (body[key as keyof BodyPendaftaran] !== undefined) dataBody[key] = body[key as keyof BodyPendaftaran]
    }

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

    const { data, error } = await supabaseAdmin.rpc('create_tenant_order', {
      p_payload: {
        idempotency_key: normalizeIdempotency((body as { idempotency_key?: unknown }).idempotency_key),
        nama_usaha: dataBody.nama_usaha,
        kontak: dataBody.kontak,
        email: dataBody.email ?? null,
        kategori_sewa_id: body.kategori_sewa_id,
        jenis_usaha: hasil.jenisUsaha,
        jenis_usaha_qty: { fnb: hasil.qtyFnb, nonFnb: hasil.qtyNonFnb },
        jumlah_tenant: hasil.jumlahTenant,
        asal: 'Internal Kampus',
        lokasi: hasil.lokasi,
        periode_daftar: hasil.periode,
        harga_akhir: hasil.harga,
        dp_wajib: Math.ceil(hasil.harga / 2),
        tgl_daftar: hasil.tglDaftar,
        tgl_acara: hasil.tglAcara,
        alamat: dataBody.alamat ?? null,
        deskripsi_usaha: dataBody.deskripsi_usaha ?? null,
        addon: hasil.addon,
      },
    })
    if (error) return rpcError(error)

    const order = (data as { order: { kode_pendaftaran: string } & Record<string, unknown> }).order
    return NextResponse.json({ ...order, t: signRef('tenant', order.kode_pendaftaran) }, { status: 201 })
  } catch (err: unknown) {
    return apiError(err)
  }
}
