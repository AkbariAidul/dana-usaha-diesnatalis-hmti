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

      const kategoriId = tenant?.kategori_sewa_id ?? daftar?.kategori_sewa_id
      const { data: kategori } = kategoriId
        ? await supabaseAdmin.from('kategori_sewa').select('nama').eq('id', kategoriId).maybeSingle()
        : { data: null }

      const totalValid = pembayaran
        .filter((p) => p.validated === true)
        .reduce((s, p) => s + Number(p.nominal ?? 0), 0)
      const hargaAkhir = Number(tenant?.harga_akhir ?? daftar?.harga_akhir ?? 0)
      const eligible = !!tenant && hargaAkhir > 0 && totalValid >= hargaAkhir * 0.8
      const waEligible = !!tenant && hargaAkhir > 0 && totalValid >= hargaAkhir * 0.5

      let waGroup: { nama: string } | null = null
      if (waEligible) {
        const [{ data: nama }, { data: link }] = await Promise.all([
          supabaseAdmin.from('pengaturan_umum').select('value').eq('key', 'wa_group_nama').maybeSingle(),
          supabaseAdmin.from('pengaturan_umum').select('value').eq('key', 'wa_group_link').maybeSingle(),
        ])
        if (link?.value) waGroup = { nama: nama?.value ?? '' }
      }

      return NextResponse.json({
        tipe,
        kode,
        daftar,
        tenant,
        kategori: kategori?.nama ?? null,
        pembayaran,
        totalValid,
        eligible,
        qr: eligible ? buatQrPayload('tenant', kode) : null,
        waGroup,
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

    if (tipe === 'bundle') {
      const { data: order } = await supabaseAdmin
        .from('bundle_order')
        .select('*')
        .eq('no_pesanan', kode)
        .maybeSingle()
      if (!order) return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })

      const [{ data: orderItems }, { data: tiketOrders }, { data: po }] = await Promise.all([
        supabaseAdmin.from('bundle_order_item').select('*').eq('bundle_order_id', order.id),
        supabaseAdmin.from('pesanan_tiket').select('*').eq('bundle_order_id', order.id),
        supabaseAdmin.from('merch_po').select('*').eq('bundle_order_id', order.id).maybeSingle(),
      ])

      const tipeIds = [...new Set((tiketOrders ?? []).map((t) => t.tiket_tipe_id).filter(Boolean))] as string[]
      const [{ data: tipeTiket }, { data: issued }] = await Promise.all([
        tipeIds.length
          ? supabaseAdmin.from('tiket_tipe').select('id,nama').in('id', tipeIds)
          : Promise.resolve({ data: [] as { id: string; nama: string }[] }),
        (tiketOrders ?? []).length
          ? supabaseAdmin
              .from('tiket_issued')
              .select('*')
              .in('pesanan_id', (tiketOrders ?? []).map((t) => t.id))
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      ])
      const tipeMap = new Map((tipeTiket ?? []).map((t) => [t.id, t.nama]))
      const issuedByPesanan = new Map<string, Record<string, unknown>[]>()
      for (const row of issued ?? []) {
        const list = issuedByPesanan.get(row.pesanan_id as string) ?? []
        list.push(row)
        issuedByPesanan.set(row.pesanan_id as string, list)
      }

      let poData = null
      if (po) {
        const [{ data: poItems }, { data: varian }, { data: merchandise }] = await Promise.all([
          supabaseAdmin.from('merch_po_item').select('*').eq('po_id', po.id),
          supabaseAdmin.from('merch_varian').select('id,nama'),
          supabaseAdmin.from('merchandise').select('id,nama,gambar_url'),
        ])
        const varianMap = new Map((varian ?? []).map((v) => [v.id, v.nama]))
        const merchMap = new Map((merchandise ?? []).map((m) => [m.id, m]))
        poData = {
          ...po,
          items: (poItems ?? []).map((i) => ({
            ...i,
            merchandise: i.merchandise_id ? merchMap.get(i.merchandise_id) ?? null : null,
            varian: i.varian_id ? { nama: varianMap.get(i.varian_id) ?? '' } : null,
          })),
        }
      }

      const tiketData = (tiketOrders ?? []).map((t) => ({
        ...t,
        tiket_tipe: { nama: tipeMap.get(t.tiket_tipe_id) ?? 'Tiket' },
        issued: issuedByPesanan.get(t.id) ?? [],
      }))

      const bisaAmbil = order.status === 'lunas' && po && !po.picked_up_at

      return NextResponse.json({
        tipe,
        kode,
        order,
        items: orderItems ?? [],
        tiket: tiketData,
        po: poData,
        qr: bisaAmbil ? buatQrPayload('po', po.no_po) : null,
      })
    }

    const { data: po } = await supabaseAdmin
      .from('merch_po')
      .select('*')
      .eq('no_po', kode)
      .maybeSingle()
    if (!po) return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })

    const [{ data: items }, { data: varian }, { data: merchandise }, { data: pengurus }, { data: cicilan }] = await Promise.all([
      supabaseAdmin.from('merch_po_item').select('*').eq('po_id', po.id),
      supabaseAdmin.from('merch_varian').select('id,nama'),
      supabaseAdmin.from('merchandise').select('id,nama,gambar_url'),
      po.pengurus_id
        ? supabaseAdmin.from('pengurus').select('nama,divisi').eq('id', po.pengurus_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from('merch_po_cicilan')
        .select('*')
        .eq('po_id', po.id)
        .order('tanggal_bayar', { ascending: true }),
    ])
    const varianMap = new Map((varian ?? []).map((v) => [v.id, v.nama]))
    const merchandiseMap = new Map((merchandise ?? []).map((m) => [m.id, m]))

    const bisaAmbil = po.status === 'lunas' && !po.picked_up_at

    return NextResponse.json({
      tipe,
      kode,
      po: { ...po, pengurus: pengurus ?? null },
      items: (items ?? []).map((i) => ({
        ...i,
        merchandise: i.merchandise_id ? merchandiseMap.get(i.merchandise_id) ?? null : null,
        varian: i.varian_id ? { nama: varianMap.get(i.varian_id) ?? '' } : null,
      })),
      cicilan: cicilan ?? [],
      qr: bisaAmbil ? buatQrPayload('po', kode) : null,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
