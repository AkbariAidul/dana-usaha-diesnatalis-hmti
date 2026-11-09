import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { signRef } from '@/lib/link-token'
import { turnstileFailure, verifyTurnstile } from '@/lib/turnstile'
import { hitungPendaftaran, PendaftaranError, type BodyPendaftaran } from '@/lib/tenant-pendaftaran'
import { clientIp, rateLimit } from '@/lib/rate-limit'

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return String(err)
}

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
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 })
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

    const slot = Number(hasil.kategori.slot_tenant) || 0
    if (slot > 0) {
      const { data: terpakai } = await supabaseAdmin
        .from('pendaftaran_tenant_pub')
        .select('jumlah_tenant')
        .eq('kategori_sewa_id', body.kategori_sewa_id)
        .not('status', 'in', '("ditolak","batal")')
      const used = (terpakai ?? []).reduce((sum: number, row: { jumlah_tenant?: number }) => sum + Number(row.jumlah_tenant ?? 1), 0)
      if (used + hasil.jumlahTenant > slot) {
        return NextResponse.json({ error: `Slot kategori tersisa ${Math.max(0, slot - used)}` }, { status: 400 })
      }
    }

    const existing = await supabaseAdmin.from('pendaftaran_tenant_pub').select('kode_pendaftaran')
    const maxKode = (existing.data || []).reduce((m: number, t: { kode_pendaftaran: string }) => {
      const n = Number(/(\d+)$/.exec(t.kode_pendaftaran)?.[1] ?? 0)
      return n > m ? n : m
    }, 0)
    const kode = `TP-${String(maxKode + 1).padStart(4, '0')}`
    const payload = {
      ...dataBody,
      jenis_usaha: hasil.jenisUsaha,
      jenis_usaha_qty: { fnb: hasil.qtyFnb, nonFnb: hasil.qtyNonFnb },
      jumlah_tenant: hasil.jumlahTenant,
      asal: 'Internal Kampus',
      lokasi: hasil.lokasi,
      addon: hasil.addon,
      tgl_daftar: hasil.tglDaftar,
      tgl_acara: hasil.tglAcara,
      periode_daftar: hasil.periode,
      harga_akhir: hasil.harga,
      dp_wajib: Math.ceil(hasil.harga / 2),
      kode_pendaftaran: kode,
      status: 'menunggu_verifikasi',
      sudah_dibayar: 0,
    }
    const turnstile = await verifyTurnstile((body as { turnstile_token?: unknown }).turnstile_token, request.headers)
    if (!turnstile.ok) {
      const failure = turnstileFailure(turnstile.reason)
      return NextResponse.json({ error: failure.error }, { status: failure.status })
    }
    let inserted = await supabaseAdmin.from('pendaftaran_tenant_pub').insert(payload).select().single()
    if (inserted.error && String(inserted.error.message).includes('jenis_usaha_qty')) {
      // ponytail: kolom belum ada (migrasi 037 belum dijalankan). Tetap simpan pendaftaran.
      const rest = { ...payload }
      delete (rest as Record<string, unknown>).jenis_usaha_qty
      inserted = await supabaseAdmin.from('pendaftaran_tenant_pub').insert(rest).select().single()
    }
    if (inserted.error) throw inserted.error
    const data = inserted.data
    return NextResponse.json({ ...data, t: signRef('tenant', data.kode_pendaftaran) }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 })
  }
}
