import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { buatQrPayload, tipeDariKode, verifyRef } from '@/lib/link-token'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const kode = String(url.searchParams.get('kode') ?? '').trim().toUpperCase()
    const t = url.searchParams.get('t')
    const tipe = tipeDariKode(kode)
    if (!tipe || !verifyRef(tipe, kode, t)) {
      return NextResponse.json({ error: 'Link tidak valid' }, { status: 403 })
    }

    if (tipe === 'tenant') {
      const [{ data: daftar }, { data: tenant }] = await Promise.all([
        supabaseAdmin.from('pendaftaran_tenant_pub').select('*').eq('kode_pendaftaran', kode).maybeSingle(),
        supabaseAdmin.from('tenants').select('*').eq('kode_stand', kode).maybeSingle(),
      ])

      let pembayaran: Record<string, unknown>[] = []
      if (tenant) {
        const { data } = await supabaseAdmin
          .from('pembayaran')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('tanggal_bayar', { ascending: true })
        pembayaran = data ?? []
      }

      const totalValid = pembayaran
        .filter((p) => p.validated === true)
        .reduce((s, p) => s + Number(p.nominal ?? 0), 0)
      const hargaAkhir = Number(tenant?.harga_akhir ?? daftar?.harga_akhir ?? 0)
      const eligible = !!tenant && hargaAkhir > 0 && totalValid >= hargaAkhir * 0.8

      return NextResponse.json({
        tipe,
        kode,
        daftar,
        tenant,
        pembayaran,
        totalValid,
        eligible,
        qr: eligible ? buatQrPayload('tenant', kode) : null,
      })
    }

    if (tipe === 'tiket') {
      const { data: pesanan } = await supabaseAdmin
        .from('pesanan_tiket')
        .select('*')
        .eq('no_pesanan', kode)
        .maybeSingle()
      if (!pesanan) return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })

      const [{ data: tipeTiket }, { data: tiket }] = await Promise.all([
        pesanan.tiket_tipe_id
          ? supabaseAdmin.from('tiket_tipe').select('nama').eq('id', pesanan.tiket_tipe_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabaseAdmin
          .from('tiket_issued')
          .select('*')
          .eq('pesanan_id', pesanan.id)
          .order('created_at', { ascending: true }),
      ])

      return NextResponse.json({
        tipe,
        kode,
        pesanan: { ...pesanan, tiket_tipe: tipeTiket ?? null },
        tiket: tiket ?? [],
      })
    }

    const { data: po } = await supabaseAdmin
      .from('merch_po')
      .select('*')
      .eq('no_po', kode)
      .maybeSingle()
    if (!po) return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })

    const [{ data: items }, { data: varian }, { data: pengurus }] = await Promise.all([
      supabaseAdmin.from('merch_po_item').select('*').eq('po_id', po.id),
      supabaseAdmin.from('merch_varian').select('id,nama'),
      po.pengurus_id
        ? supabaseAdmin.from('pengurus').select('nama,divisi').eq('id', po.pengurus_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    const varianMap = new Map((varian ?? []).map((v) => [v.id, v.nama]))

    const bisaAmbil = po.status === 'lunas' && !po.picked_up_at

    return NextResponse.json({
      tipe,
      kode,
      po: { ...po, pengurus: pengurus ?? null },
      items: (items ?? []).map((i) => ({
        ...i,
        varian: i.varian_id ? { nama: varianMap.get(i.varian_id) ?? '' } : null,
      })),
      qr: bisaAmbil ? buatQrPayload('po', kode) : null,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
