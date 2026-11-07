import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyRef } from '@/lib/link-token'
import { isBuktiUrl } from '@/lib/bukti'
import { kirimNotifTenantMenungguVerifikasi } from '@/lib/notifikasi-tenant'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const buktiUrl = String(body.bukti_url ?? '').trim()
    const t = typeof body.t === 'string' ? body.t : null
    if (!buktiUrl) {
      return NextResponse.json({ error: 'Bukti pembayaran wajib diupload' }, { status: 400 })
    }
    const { data: pendaftaran } = await supabaseAdmin
      .from('pendaftaran_tenant_pub')
      .select('id,kode_pendaftaran,nama_usaha,kontak,harga_akhir,dp_wajib,sudah_dibayar,pembayaran_tipe,nominal_bayar,jumlah_tenant,addon,status')
      .eq('id', id)
      .maybeSingle()
    if (!pendaftaran) {
      return NextResponse.json({ error: 'Pendaftaran tidak ditemukan' }, { status: 404 })
    }
    if (!verifyRef('tenant', pendaftaran.kode_pendaftaran, t)) {
      return NextResponse.json({ error: 'Link tidak valid' }, { status: 403 })
    }
    if (['dp_diterima', 'lunas', 'batal'].includes(String(pendaftaran.status))) {
      return NextResponse.json({ error: 'Pendaftaran sudah diverifikasi' }, { status: 400 })
    }
    if (!isBuktiUrl(buktiUrl)) {
      return NextResponse.json({ error: 'Bukti pembayaran tidak valid' }, { status: 400 })
    }

    const total = Number(pendaftaran.harga_akhir)
    const sudah = Number(pendaftaran.sudah_dibayar ?? 0)
    const tipe = body.pembayaran_tipe === 'lunas' ? 'lunas' : 'nyicil'
    const nominal = Number(body.nominal_bayar)
    if (!Number.isFinite(nominal) || nominal <= 0) {
      return NextResponse.json({ error: 'Nominal pembayaran tidak valid' }, { status: 400 })
    }
    if (nominal > total - sudah + 0.01) {
      return NextResponse.json({ error: 'Nominal melebihi sisa pembayaran' }, { status: 400 })
    }
    if (sudah + nominal < Math.ceil(total / 2) - 0.01) {
      return NextResponse.json({ error: 'Pembayaran pertama minimal 50% dari total' }, { status: 400 })
    }
    const { error } = await supabaseAdmin
      .from('pendaftaran_tenant_pub')
      .update({
        bukti_url: buktiUrl,
        status: 'menunggu_verifikasi',
        pembayaran_tipe: tipe,
        nominal_bayar: nominal,
      })
      .eq('id', id)
    if (error) throw error
    try {
      await kirimNotifTenantMenungguVerifikasi(request, {
        ...pendaftaran,
        pembayaran_tipe: tipe,
        nominal_bayar: nominal,
      })
    } catch (notifError) {
      console.error('Notifikasi tenant gagal:', notifError)
    }
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
