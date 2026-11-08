import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyRef } from '@/lib/link-token'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const kode = id.trim().toUpperCase()
    const t = new URL(request.url).searchParams.get('t')
    if (!verifyRef('tenant', kode, t)) {
      return NextResponse.json({ error: 'Link tidak valid' }, { status: 403 })
    }

    const [{ data: tenant }, { data: link }] = await Promise.all([
      supabaseAdmin.from('tenants').select('id,harga_akhir').eq('kode_stand', kode).maybeSingle(),
      supabaseAdmin.from('pengaturan_umum').select('value').eq('key', 'wa_group_link').maybeSingle(),
    ])
    if (!tenant) return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 })

    const { data: bayar } = await supabaseAdmin
      .from('pembayaran')
      .select('nominal')
      .eq('tenant_id', tenant.id)
      .eq('validated', true)
    const totalValid = (bayar ?? []).reduce((s, p) => s + Number(p.nominal ?? 0), 0)
    const harga = Number(tenant.harga_akhir ?? 0)
    if (!(harga > 0 && totalValid >= harga * 0.5)) {
      return NextResponse.json({ error: 'Grup tersedia setelah pembayaran pertama (min. 50%) tervalidasi' }, { status: 403 })
    }

    const url = String(link?.value ?? '').trim()
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'Link grup belum diatur' }, { status: 404 })
    }
    return NextResponse.redirect(url, 302)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
