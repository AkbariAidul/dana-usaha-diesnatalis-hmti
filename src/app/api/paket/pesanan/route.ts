import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createAuditLog } from '@/lib/queries'
import { buatQrPayload, signRef } from '@/lib/link-token'
import { baseUrl, kirimWhatsApp } from '@/lib/notifikasi-tiket'
import { formatRupiah } from '@/lib/utils'

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
  const { data: order } = await supabaseAdmin
    .from('bundle_order')
    .select('*')
    .eq('id', bundleOrderId)
    .maybeSingle()
  if (!order) return

  const [{ data: items }, { data: bundle }] = await Promise.all([
    supabaseAdmin.from('bundle_order_item').select('*').eq('bundle_order_id', bundleOrderId).order('id'),
    order.bundle_id
      ? supabaseAdmin.from('bundle').select('nama').eq('id', order.bundle_id).maybeSingle()
      : Promise.resolve({ data: null as { nama: string } | null }),
  ])

  const barisItem = (items ?? []).map((i) => {
    const varian = [i.warna, i.lengan, i.ukuran].filter(Boolean).join(' · ')
    const label = i.tipe === 'tiket' ? 'Tiket' : 'Merch'
    return `- ${i.qty}× ${i.nama_snapshot}${varian ? ` (${varian})` : ''} [${label}]`
  })
  const link = `${baseUrl(request)}/lacak/${encodeURIComponent(order.no_pesanan)}?t=${encodeURIComponent(signRef('bundle', order.no_pesanan))}`

  const message = [
    `Halo ${order.nama_pembeli}, pembayaran paket combo kamu sudah diverifikasi.`,
    '',
    `Kode pesanan: ${order.no_pesanan}`,
    `Paket: ${bundle?.nama || 'Paket Combo'}`,
    'Status: Lunas / terverifikasi.',
    '',
    'Isi paket:',
    ...barisItem,
    '',
    `Total: ${formatRupiah(Number(order.total))}`,
    '',
    'QR tiket & QR pengambilan merchandise sudah aktif di halaman riwayat paket combo:',
    link,
    '',
    'Hormat Kami,',
    'Panitia Danus In4Days XI',
  ].join('\n')

  try {
    await kirimWhatsApp(order.kontak, message)
  } catch (err) {
    console.error('Notif paket combo gagal:', err)
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
