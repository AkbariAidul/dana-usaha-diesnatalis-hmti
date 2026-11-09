import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createAuditLog } from '@/lib/queries'
import { buatQrPayload } from '@/lib/link-token'
import { kirimNotifTerverifikasi } from '@/lib/notifikasi-tiket'
import { kirimNotifPoTerverifikasi } from '@/lib/notifikasi-po'

async function terbitkanTiket(pesananId: string) {
  const { data: existing } = await supabaseAdmin
    .from('tiket_issued')
    .select('id')
    .eq('pesanan_id', pesananId)
    .limit(1)
  if (existing?.length) return

  const { data: pesanan } = await supabaseAdmin
    .from('pesanan_tiket')
    .select('id,tiket_tipe_id,jumlah')
    .eq('id', pesananId)
    .single()
  if (!pesanan) return

  const { data: tipeData } = await supabaseAdmin
    .from('tiket_tipe')
    .select('kuota,terjual')
    .eq('id', pesanan.tiket_tipe_id)
    .single()
  if (tipeData) {
    await supabaseAdmin
      .from('tiket_tipe')
      .update({ terjual: Number(tipeData.terjual ?? 0) + Number(pesanan.jumlah) })
      .eq('id', pesanan.tiket_tipe_id)
  }

  for (let i = 0; i < pesanan.jumlah; i++) {
    await supabaseAdmin.from('tiket_issued').insert({
      pesanan_id: pesananId,
      kode_qr: crypto.randomUUID().replace(/-/g, ''),
      kode_tampil: `DN2026-${String(Date.now()).slice(-6)}-${String(i + 1).padStart(3, '0')}`,
      status: 'belum_divalidasi',
    })
  }
}

async function kirimNotifOrder(request: Request, bundleOrderId: string) {
  const { data: tiketOrders } = await supabaseAdmin
    .from('pesanan_tiket')
    .select('*')
    .eq('bundle_order_id', bundleOrderId)
  for (const pesanan of tiketOrders ?? []) {
    try {
      const { data: tipe } = await supabaseAdmin
        .from('tiket_tipe')
        .select('nama')
        .eq('id', pesanan.tiket_tipe_id)
        .maybeSingle()
      await kirimNotifTerverifikasi(request, pesanan, tipe?.nama || 'Tiket')
    } catch (err) {
      console.error('Notif tiket bundle gagal:', err)
    }
  }

  const { data: po } = await supabaseAdmin
    .from('merch_po')
    .select('*')
    .eq('bundle_order_id', bundleOrderId)
    .maybeSingle()
  if (!po) return
  try {
    const [{ data: items }, { data: merchandise }, { data: varian }] = await Promise.all([
      supabaseAdmin.from('merch_po_item').select('*').eq('po_id', po.id),
      supabaseAdmin.from('merchandise').select('id,nama'),
      supabaseAdmin.from('merch_varian').select('id,nama'),
    ])
    const merchMap = new Map((merchandise ?? []).map((m) => [m.id, m.nama]))
    const varianMap = new Map((varian ?? []).map((v) => [v.id, v.nama]))
    const itemDetails = (items ?? []).map((item) => ({
      nama_produk: merchMap.get(item.merchandise_id ?? '') ?? 'Item',
      ukuran: item.varian_id ? varianMap.get(item.varian_id) ?? null : null,
      warna: item.warna ?? null,
      lengan: item.lengan ?? null,
      qty: Number(item.qty),
      harga_satuan: Number(item.harga_satuan),
      subtotal: Number(item.subtotal),
    }))
    await kirimNotifPoTerverifikasi(request, { ...po, items: itemDetails })
  } catch (err) {
    console.error('Notif PO bundle gagal:', err)
  }
}

export async function GET() {
  try {
    const { data: orders, error } = await supabaseAdmin
      .from('bundle_order')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error

    const list = orders ?? []
    const ids = list.map((o) => o.id)
    const bundleIds = [...new Set(list.map((o) => o.bundle_id).filter(Boolean))] as string[]
    const [{ data: items }, { data: bundles }, { data: pos }, { data: tiketOrders }] = await Promise.all([
      ids.length
        ? supabaseAdmin.from('bundle_order_item').select('*').in('bundle_order_id', ids)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      bundleIds.length
        ? supabaseAdmin.from('bundle').select('id,nama').in('id', bundleIds)
        : Promise.resolve({ data: [] as { id: string; nama: string }[] }),
      ids.length
        ? supabaseAdmin.from('merch_po').select('id,no_po,bundle_order_id').in('bundle_order_id', ids)
        : Promise.resolve({ data: [] as { id: string; no_po: string; bundle_order_id: string }[] }),
      ids.length
        ? supabaseAdmin.from('pesanan_tiket').select('id,bundle_order_id').in('bundle_order_id', ids)
        : Promise.resolve({ data: [] as { id: string; bundle_order_id: string }[] }),
    ])
    const bundleMap = new Map((bundles ?? []).map((b) => [b.id, b.nama]))
    const poMap = new Map((pos ?? []).map((p) => [p.bundle_order_id, p]))
    const tiketIds = (tiketOrders ?? []).map((t) => t.id)
    const { data: issued } = tiketIds.length
      ? await supabaseAdmin.from('tiket_issued').select('id,pesanan_id').in('pesanan_id', tiketIds)
      : { data: [] as { id: string; pesanan_id: string }[] }
    const pesananBerTiket = new Set((issued ?? []).map((i) => i.pesanan_id))
    const bundlePunyaTiket = new Set(
      (tiketOrders ?? []).filter((t) => pesananBerTiket.has(t.id)).map((t) => t.bundle_order_id),
    )

    const result = list.map((o) => {
      const po = poMap.get(o.id)
      return {
        ...o,
        bundle_nama: o.bundle_id ? bundleMap.get(o.bundle_id) ?? null : null,
        qr_baju: o.status === 'lunas' && po ? buatQrPayload('po', po.no_po) : null,
        qr_tiket: o.status === 'lunas' && bundlePunyaTiket.has(o.id) ? buatQrPayload('bundle', o.no_pesanan) : null,
        items: (items ?? []).filter((i) => i.bundle_order_id === o.id),
      }
    })
    return NextResponse.json(result)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, status, catatan_admin } = body
    const allowed = ['menunggu_verifikasi', 'lunas', 'ditolak', 'batal']
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    const { data: order } = await supabaseAdmin
      .from('bundle_order')
      .select('id,no_pesanan,status,total')
      .eq('id', id)
      .maybeSingle()
    if (!order) return NextResponse.json({ error: 'Pesanan paket tidak ditemukan' }, { status: 404 })

    const payload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }
    if (catatan_admin !== undefined) payload.catatan_admin = catatan_admin
    if (status === 'lunas') {
      payload.verified_at = new Date().toISOString()
      payload.verified_by = 'admin'
    }

    const { data, error } = await supabaseAdmin
      .from('bundle_order')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    const downstreamStatus = status === 'lunas' ? 'lunas' : status === 'menunggu_verifikasi' ? 'menunggu_verifikasi' : 'batal'

    await supabaseAdmin
      .from('pesanan_tiket')
      .update({ status: downstreamStatus, verified_at: status === 'lunas' ? new Date().toISOString() : null })
      .eq('bundle_order_id', id)

    const { data: po } = await supabaseAdmin
      .from('merch_po')
      .select('id,total')
      .eq('bundle_order_id', id)
      .maybeSingle()
    if (po) {
      await supabaseAdmin
        .from('merch_po')
        .update({
          status: downstreamStatus,
          sudah_dibayar: status === 'lunas' ? Number(po.total) : 0,
          verified_at: status === 'lunas' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', po.id)
    }

    if (status === 'lunas') {
      const { data: tiketOrders } = await supabaseAdmin
        .from('pesanan_tiket')
        .select('id')
        .eq('bundle_order_id', id)
      for (const t of tiketOrders ?? []) {
        await terbitkanTiket(t.id)
      }
      await kirimNotifOrder(request, id)
    }

    await createAuditLog({ aksi: 'VERIFIKASI_BUNDLE', target_type: 'bundle_order', target_id: id, data_baru: data })
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { ids }: { ids: string[] } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 })
    }
    for (const id of ids) {
      const { data: tiketOrders } = await supabaseAdmin
        .from('pesanan_tiket')
        .select('id')
        .eq('bundle_order_id', id)
      for (const t of tiketOrders ?? []) {
        await supabaseAdmin.from('tiket_issued').delete().eq('pesanan_id', t.id)
      }
      const { data: pos } = await supabaseAdmin.from('merch_po').select('id').eq('bundle_order_id', id)
      for (const p of pos ?? []) {
        await supabaseAdmin.from('merch_po_item').delete().eq('po_id', p.id)
        await supabaseAdmin.from('merch_po_cicilan').delete().eq('po_id', p.id)
      }
      await supabaseAdmin.from('merch_po').delete().eq('bundle_order_id', id)
      await supabaseAdmin.from('pesanan_tiket').delete().eq('bundle_order_id', id)
    }
    const { error } = await supabaseAdmin.from('bundle_order').delete().in('id', ids)
    if (error) throw error
    return NextResponse.json({ success: true, deleted: ids.length })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
