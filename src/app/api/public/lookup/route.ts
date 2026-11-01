import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { kontakCocok } from '@/lib/kontak'
import { signRef, tipeDariKode } from '@/lib/link-token'

const attempts = new Map<string, number[]>()
const WINDOW = 10 * 60 * 1000
const MAX = 12

function dibatasi(ip: string) {
  const now = Date.now()
  const list = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW)
  if (list.length >= MAX) return true
  list.push(now)
  attempts.set(ip, list)
  return false
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (dibatasi(ip)) {
      return NextResponse.json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' }, { status: 429 })
    }

    const body = await request.json()
    const kode = String(body.kode ?? '').trim().toUpperCase()
    const kontak = String(body.kontak ?? '').trim()
    const tipe = tipeDariKode(kode)
    if (!tipe || !kontak) {
      return NextResponse.json({ error: 'Kode atau kontak tidak valid' }, { status: 400 })
    }

    let cocok = false
    if (tipe === 'tenant') {
      const { data: daftar } = await supabaseAdmin
        .from('pendaftaran_tenant_pub')
        .select('kontak,email')
        .eq('kode_pendaftaran', kode)
        .maybeSingle()
      cocok = !!daftar && kontakCocok(kontak, daftar.kontak, daftar.email)
      if (!cocok) {
        const { data: tenant } = await supabaseAdmin
          .from('tenants')
          .select('kontak,email')
          .eq('kode_stand', kode)
          .maybeSingle()
        cocok = !!tenant && kontakCocok(kontak, tenant.kontak, tenant.email)
      }
    } else if (tipe === 'tiket') {
      const { data } = await supabaseAdmin
        .from('pesanan_tiket')
        .select('kontak,email')
        .eq('no_pesanan', kode)
        .maybeSingle()
      cocok = !!data && kontakCocok(kontak, data.kontak, data.email)
    } else {
      const { data } = await supabaseAdmin
        .from('merch_po')
        .select('kontak,email')
        .eq('no_po', kode)
        .maybeSingle()
      cocok = !!data && kontakCocok(kontak, data.kontak, data.email)
    }

    if (!cocok) {
      return NextResponse.json({ error: 'Data tidak ditemukan. Periksa kode dan kontak.' }, { status: 404 })
    }

    return NextResponse.json({
      kode,
      tipe,
      t: signRef(tipe, kode),
      redirect: `/lacak/${kode}?t=${encodeURIComponent(signRef(tipe, kode))}`,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
