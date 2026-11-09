import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getStrukTiket } from '@/lib/queries'
import { tipeDariKode, verifyRef } from '@/lib/link-token'
import { linkPo } from '@/lib/notifikasi-po'
import { linkTiket } from '@/lib/notifikasi-tiket'
import { linkTenant } from '@/lib/notifikasi-tenant'
import { buatStrukPoPdf, buatStrukTenantPdf, buatStrukTiketPdf, namaFileStruk } from '@/lib/struk-po'

export const runtime = 'nodejs'

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
      const { data: tenant } = await supabaseAdmin.from('tenants').select('*').eq('kode_stand', kode).maybeSingle()
      if (!tenant) return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 })
      if (tenant.status !== 'lunas') {
        return NextResponse.json({ error: 'Struk tersedia setelah pembayaran lunas' }, { status: 403 })
      }

      const { data: kategori } = await supabaseAdmin
        .from('kategori_sewa')
        .select('nama')
        .eq('id', tenant.kategori_sewa_id)
        .maybeSingle()

      const addon = Array.isArray(tenant.addon) ? tenant.addon : []
      const buffer = await buatStrukTenantPdf(
        {
          kode_stand: tenant.kode_stand,
          nama_usaha: tenant.nama_usaha,
          kontak: tenant.kontak,
          harga_akhir: Number(tenant.harga_akhir),
          base_harga: Number(tenant.base_harga ?? tenant.harga_akhir),
          sudah_dibayar: Number(tenant.sudah_dibayar ?? 0),
          status: tenant.status,
          tgl_daftar: tenant.tgl_daftar,
          kategori: kategori?.nama ?? '-',
          jumlah_tenant: Number(tenant.jumlah_tenant ?? 1),
          jenis_usaha_qty: tenant.jenis_usaha_qty ?? null,
        },
        addon.map((item: { nama: string; qty: number; harga_satuan: number; subtotal: number }) => ({
          nama: item.nama,
          qty: Number(item.qty),
          harga_satuan: Number(item.harga_satuan),
          subtotal: Number(item.subtotal),
        })),
        linkTenant(request, tenant.kode_stand)
      )

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${namaFileStruk(tenant.kode_stand)}"`,
        },
      })
    }

    if (tipe === 'tiket') {
      const pesanan = await getStrukTiket(kode)
      if (!pesanan) return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
      if (pesanan.status !== 'lunas') {
        return NextResponse.json({ error: 'Struk tersedia setelah pembayaran lunas' }, { status: 403 })
      }
      const buffer = await buatStrukTiketPdf(pesanan, linkTiket(request, kode))
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${namaFileStruk(pesanan.no_pesanan)}"`,
        },
      })
    }

    const { data: po } = await supabaseAdmin.from('merch_po').select('*').eq('no_po', kode).maybeSingle()
    if (!po) return NextResponse.json({ error: 'PO tidak ditemukan' }, { status: 404 })
    if (po.status !== 'lunas') {
      return NextResponse.json({ error: 'Struk tersedia setelah pembayaran lunas' }, { status: 403 })
    }

    const [{ data: items }, { data: varian }, { data: merchandise }] = await Promise.all([
      supabaseAdmin.from('merch_po_item').select('*').eq('po_id', po.id),
      supabaseAdmin.from('merch_varian').select('id,nama'),
      supabaseAdmin.from('merchandise').select('id,nama'),
    ])
    const varianMap = new Map((varian ?? []).map((v) => [v.id, v.nama]))
    const merchandiseMap = new Map((merchandise ?? []).map((m) => [m.id, m.nama]))

    const buffer = await buatStrukPoPdf(
      po,
      (items ?? []).map((item) => ({
        nama: merchandiseMap.get(item.merchandise_id) ?? 'Merchandise',
        ukuran: [item.warna, item.lengan, item.varian_id ? varianMap.get(item.varian_id) ?? item.ukuran : item.ukuran].filter(Boolean).join(' · ') || null,
        qty: Number(item.qty),
        harga_satuan: Number(item.harga_satuan),
        subtotal: Number(item.subtotal),
      })),
      linkPo(request, kode)
    )

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${namaFileStruk(po.no_po)}"`,
      },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
