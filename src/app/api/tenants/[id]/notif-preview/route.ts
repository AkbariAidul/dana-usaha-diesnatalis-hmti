import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  pesanTenantCheckin,
  pesanTenantDitolak,
  pesanTenantMenungguVerifikasi,
  pesanTenantTerverifikasi,
} from '@/lib/notifikasi-tenant'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('kode_stand,nama_usaha,kontak,harga_akhir,sudah_dibayar,jumlah_tenant,addon')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!tenant) return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 })

    const total = Number(tenant.harga_akhir ?? 0)
    const sudah = Number(tenant.sudah_dibayar ?? 0)
    const sisa = Math.max(0, total - sudah)
    const contohBayar = sisa > 0 ? Math.ceil(sisa / 2) : 0
    const dasar = {
      ...tenant,
      sudah_dibayar: sudah,
      nominal_bayar: contohBayar,
      catatan_admin: 'Contoh: bukti transfer tidak terbaca',
    }

    return NextResponse.json([
      { jenis: 'menunggu_verifikasi', pesan: pesanTenantMenungguVerifikasi(request, dasar) },
      { jenis: 'terverifikasi', pesan: pesanTenantTerverifikasi(request, { ...dasar, sudah_dibayar: sudah + contohBayar }) },
      { jenis: 'ditolak', pesan: pesanTenantDitolak(request, dasar) },
      { jenis: 'checkin', pesan: pesanTenantCheckin(request, dasar) },
    ])
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
