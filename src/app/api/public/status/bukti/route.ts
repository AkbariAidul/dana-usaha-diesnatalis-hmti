import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { tipeDariKode, verifyRef } from '@/lib/link-token'
import { todayISO } from '@/lib/utils'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const kode = String(body.kode ?? '').trim().toUpperCase()
    const t = body.t as string | null
    const buktiUrl = String(body.bukti_url ?? '').trim()
    const tipe = tipeDariKode(kode)
    if (!tipe || !verifyRef(tipe, kode, t)) {
      return NextResponse.json({ error: 'Link tidak valid' }, { status: 403 })
    }
    if (!buktiUrl) {
      return NextResponse.json({ error: 'Bukti pembayaran wajib diupload' }, { status: 400 })
    }

    if (tipe === 'tenant') {
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('id,harga_akhir,sudah_dibayar')
        .eq('kode_stand', kode)
        .maybeSingle()
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant belum diverifikasi admin' }, { status: 400 })
      }

      const nominal = Number(body.nominal)
      if (!Number.isFinite(nominal) || nominal <= 0) {
        return NextResponse.json({ error: 'Nominal pembayaran tidak valid' }, { status: 400 })
      }

      const { data: payments } = await supabaseAdmin
        .from('pembayaran')
        .select('nominal,validated')
        .eq('tenant_id', tenant.id)
      const totalValid = (payments ?? [])
        .filter((p) => p.validated === true)
        .reduce((s, p) => s + Number(p.nominal ?? 0), 0)
      const sisa = Number(tenant.harga_akhir) - totalValid
      if (nominal > sisa + 0.01) {
        return NextResponse.json({ error: 'Nominal melebihi sisa pembayaran' }, { status: 400 })
      }

      const { count } = await supabaseAdmin
        .from('pembayaran')
        .select('*', { count: 'exact', head: true })
      const no = `TRX-${String((count ?? 0) + 1).padStart(4, '0')}`
      const jenis = totalValid + nominal >= Number(tenant.harga_akhir) ? 'Pelunasan' : 'Cicilan'

      const { error } = await supabaseAdmin.from('pembayaran').insert({
        tenant_id: tenant.id,
        no_transaksi: no,
        tanggal_bayar: todayISO(),
        jenis,
        nominal,
        metode: 'QRIS',
        bukti_url: buktiUrl,
        dicatat_oleh: 'Publik',
        keterangan: 'Upload dari halaman lacak',
        validated: false,
      })
      if (error) throw error

      return NextResponse.json({ success: true, message: 'Bukti terkirim, menunggu verifikasi admin' })
    }

    if (tipe === 'tiket') {
      const { data: pesanan } = await supabaseAdmin
        .from('pesanan_tiket')
        .select('id,status')
        .eq('no_pesanan', kode)
        .maybeSingle()
      if (!pesanan) return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
      if (pesanan.status === 'lunas') {
        return NextResponse.json({ error: 'Pesanan sudah lunas' }, { status: 400 })
      }
      const { error } = await supabaseAdmin
        .from('pesanan_tiket')
        .update({ bukti_url: buktiUrl, status: 'menunggu_verifikasi', updated_at: new Date().toISOString() })
        .eq('id', pesanan.id)
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Bukti terkirim, menunggu verifikasi admin' })
    }

    const { data: po } = await supabaseAdmin
      .from('merch_po')
      .select('id,status')
      .eq('no_po', kode)
      .maybeSingle()
    if (!po) return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
    if (po.status === 'lunas') {
      return NextResponse.json({ error: 'Pesanan sudah lunas' }, { status: 400 })
    }
    const { error } = await supabaseAdmin
      .from('merch_po')
      .update({ bukti_url: buktiUrl, status: 'menunggu_verifikasi', updated_at: new Date().toISOString() })
      .eq('id', po.id)
    if (error) throw error
    return NextResponse.json({ success: true, message: 'Bukti terkirim, menunggu verifikasi admin' })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
