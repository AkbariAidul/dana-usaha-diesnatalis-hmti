import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTicketKatalog } from '@/lib/queries'
import { signRef } from '@/lib/link-token'
import { turnstileFailure, verifyTurnstile } from '@/lib/turnstile'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { apiError, rpcError } from '@/lib/api-error'
import { normalizeIdempotency } from '@/lib/idempotency'

export async function POST(request: Request) {
  try {
    if (!rateLimit(`tiket:${clientIp(request.headers)}`, 10, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Terlalu banyak permintaan. Coba lagi nanti.' }, { status: 429 })
    }
    const body = await request.json()
    if (!body.nama_pembeli || !body.kontak) {
      return NextResponse.json({ error: 'Nama dan kontak wajib diisi' }, { status: 400 })
    }

    const tipe = (await getTicketKatalog()).find((t) => t.id === body.tiket_tipe_id)
    if (!tipe) return NextResponse.json({ error: 'Tipe tiket tidak ditemukan' }, { status: 400 })
    if (!tipe.buka) {
      return NextResponse.json({ error: 'Tiket sedang ditutup atau sudah habis' }, { status: 400 })
    }

    const jumlah = Math.max(1, Math.floor(Number(body.jumlah || 1)))
    if (tipe.sisa !== null && jumlah > tipe.sisa) {
      return NextResponse.json({ error: `Sisa tiket ${tipe.sisa}` }, { status: 400 })
    }

    const hargaSatuan = Number(tipe.harga_aktif)
    const bundle = tipe.bundle_discounts.find((b) => Number(b.jumlah_min) === jumlah)
    const diskon = bundle ? Number(bundle.diskon_persen) : 0
    const subtotal = hargaSatuan * jumlah
    const total = Math.round(subtotal * (1 - diskon / 100))

    const turnstile = await verifyTurnstile(body.turnstile_token, request.headers)
    if (!turnstile.ok) {
      const failure = turnstileFailure(turnstile.reason)
      return NextResponse.json({ error: failure.error }, { status: failure.status })
    }

    const { data, error } = await supabaseAdmin.rpc('create_tiket_order', {
      p_payload: {
        idempotency_key: normalizeIdempotency(body.idempotency_key),
        nama_pembeli: body.nama_pembeli,
        kontak: body.kontak,
        email: body.email || null,
        tiket_tipe_id: body.tiket_tipe_id,
        jumlah,
        harga_satuan: hargaSatuan,
        diskon_persen: diskon,
        total,
      },
    })
    if (error) return rpcError(error)

    const order = (data as { order: Record<string, unknown> }).order
    return NextResponse.json(
      { ...order, t: signRef('tiket', String(order.no_pesanan)) },
      { status: 201 },
    )
  } catch (err: unknown) {
    return apiError(err)
  }
}
