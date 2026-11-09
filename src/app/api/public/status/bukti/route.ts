import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { tipeDariKode, verifyRef } from '@/lib/link-token'
import { todayISO } from '@/lib/utils'
import { kirimNotifPoMenungguVerifikasi } from '@/lib/notifikasi-po'
import { kirimNotifTenantMenungguVerifikasi } from '@/lib/notifikasi-tenant'

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
        .select('id,kode_stand,nama_usaha,kontak,harga_akhir,dp_wajib,sudah_dibayar,jumlah_tenant,addon')
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
      if (totalValid + nominal < Math.ceil(Number(tenant.harga_akhir) / 2) - 0.01) {
        return NextResponse.json({ error: 'Pembayaran pertama minimal 50% dari total' }, { status: 400 })
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

      try {
        await kirimNotifTenantMenungguVerifikasi(request, {
          ...tenant,
          sudah_dibayar: totalValid,
          nominal_bayar: nominal,
        })
      } catch (notifError) {
        console.error('Notifikasi tenant gagal:', notifError)
      }
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
      .select('id,status,no_po,nama_pemesan,kontak,total,sudah_dibayar,pembayaran_metode,pembayaran_tipe,tipe_pemesan')
      .eq('no_po', kode)
      .maybeSingle()
    if (!po) return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
    if (po.status === 'lunas') {
      return NextResponse.json({ error: 'Pesanan sudah lunas' }, { status: 400 })
    }

    const { data: poItems } = await supabaseAdmin
      .from('merch_po_item')
      .select('merchandise_id,varian_id,warna,lengan,qty,harga_satuan,subtotal')
      .eq('po_id', po.id)

    const { data: merchandise } = await supabaseAdmin
      .from('merchandise')
      .select('id,nama')
    const merchMap = new Map((merchandise ?? []).map((m) => [m.id, m.nama]))

    const { data: varian } = await supabaseAdmin
      .from('merch_varian')
      .select('id,nama')
    const varianMap = new Map((varian ?? []).map((v) => [v.id, v.nama]))

    const itemDetails = (poItems ?? []).map((item) => ({
      nama_produk: merchMap.get(item.merchandise_id ?? '') ?? 'Item',
      ukuran: item.varian_id ? varianMap.get(item.varian_id) ?? null : null,
      warna: item.warna ?? null,
      lengan: item.lengan ?? null,
      qty: Number(item.qty),
      harga_satuan: Number(item.harga_satuan),
      subtotal: Number(item.subtotal),
    }))

    const nominal = Number(body.nominal)
    if (!Number.isFinite(nominal) || nominal <= 0) {
      return NextResponse.json({ error: 'Nominal pembayaran wajib diisi' }, { status: 400 })
    }
    const metode = body.metode === 'Cash' ? 'Cash' : 'QRIS'

    const { data: cicilanValid } = await supabaseAdmin
      .from('merch_po_cicilan')
      .select('nominal')
      .eq('po_id', po.id)
      .eq('validated', true)
    const totalValid = (cicilanValid ?? []).reduce((s, c) => s + Number(c.nominal), 0)
    const sisa = Number(po.total) - totalValid
    if (nominal > sisa + 0.01) {
      return NextResponse.json({ error: `Nominal melebihi sisa pembayaran (${sisa.toLocaleString('id-ID')})` }, { status: 400 })
    }

    const { count } = await supabaseAdmin
      .from('merch_po_cicilan')
      .select('*', { count: 'exact', head: true })
    const noTransaksi = `CCL-${String((count ?? 0) + 1).padStart(4, '0')}`

    const { error: cicilanError } = await supabaseAdmin.from('merch_po_cicilan').insert({
      po_id: po.id,
      no_transaksi: noTransaksi,
      tanggal_bayar: new Date().toISOString(),
      nominal,
      metode,
      bukti_url: buktiUrl,
      validated: false,
    })
    if (cicilanError) throw cicilanError

    const { data: updated, error } = await supabaseAdmin
      .from('merch_po')
      .update({ bukti_url: buktiUrl, status: 'menunggu_verifikasi', updated_at: new Date().toISOString() })
      .eq('id', po.id)
      .select('status,no_po,nama_pemesan,kontak,total,sudah_dibayar,pembayaran_metode,pembayaran_tipe,tipe_pemesan')
      .single()
    if (error) throw error

    try {
      await kirimNotifPoMenungguVerifikasi(request, {
        ...updated,
        items: itemDetails,
        nominal_cicilan: nominal,
        metode_cicilan: metode,
      })
    } catch (notifError) {
      console.error('Notifikasi PO gagal:', notifError)
    }
    return NextResponse.json({ success: true, message: 'Bukti terkirim, menunggu verifikasi admin' })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
