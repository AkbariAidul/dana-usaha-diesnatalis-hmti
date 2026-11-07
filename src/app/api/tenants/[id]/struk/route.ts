import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { linkTenant } from '@/lib/notifikasi-tenant'
import { buatStrukTenantPdf, namaFileStruk } from '@/lib/struk-po'

export const runtime = 'nodejs'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { data: tenant } = await supabaseAdmin.from('tenants').select('*').eq('id', id).maybeSingle()
    if (!tenant) return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 })

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
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
