import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getBundles } from '@/lib/bundle'
import { createAuditLog } from '@/lib/queries'

type ItemInput = { tipe?: string; ref_id?: string; qty?: number }

function normalizeItems(input: unknown) {
  if (!Array.isArray(input)) return []
  return input
    .map((raw) => {
      const item = raw as ItemInput
      const tipe = item.tipe === 'tiket' ? 'tiket' : item.tipe === 'merch' ? 'merch' : null
      if (!tipe || !item.ref_id) return null
      return { tipe, ref_id: String(item.ref_id), qty: Math.max(1, Number(item.qty) || 1) }
    })
    .filter(Boolean) as Array<{ tipe: 'tiket' | 'merch'; ref_id: string; qty: number }>
}

export async function GET() {
  try {
    const data = await getBundles()
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const items = normalizeItems(body.items)
    if (!body.nama || !String(body.nama).trim()) throw new Error('Nama paket wajib diisi')
    if (items.length === 0) throw new Error('Paket minimal berisi satu item')

    const payload = {
      nama: String(body.nama).trim(),
      deskripsi: body.deskripsi ? String(body.deskripsi) : null,
      gambar_url: body.gambar_url ? String(body.gambar_url) : null,
      harga_bundle: Math.max(0, Number(body.harga_bundle) || 0),
      aktif: body.aktif !== false,
      tgl_mulai: body.tgl_mulai || null,
      // Input tanggal (YYYY-MM-DD) dianggap berlaku sampai akhir hari.
      tgl_selesai: body.tgl_selesai
        ? String(body.tgl_selesai).length === 10
          ? `${String(body.tgl_selesai)}T23:59:59`
          : String(body.tgl_selesai)
        : null,
      kuota: Math.max(0, Number(body.kuota) || 0),
      urutan: Number(body.urutan) || 0,
      updated_at: new Date().toISOString(),
    }

    let bundleId = body.id ? String(body.id) : ''
    if (bundleId) {
      const { error } = await supabaseAdmin.from('bundle').update(payload).eq('id', bundleId)
      if (error) throw error
      await supabaseAdmin.from('bundle_item').delete().eq('bundle_id', bundleId)
    } else {
      const { data, error } = await supabaseAdmin.from('bundle').insert(payload).select().single()
      if (error) throw error
      bundleId = data.id
    }

    const insertItems = items.map((item, index) => ({
      bundle_id: bundleId,
      tipe: item.tipe,
      ref_id: item.ref_id,
      qty: item.qty,
      urutan: index,
    }))
    const { error: itemError } = await supabaseAdmin.from('bundle_item').insert(insertItems)
    if (itemError) throw itemError

    const data = (await getBundles()).find((b) => b.id === bundleId) ?? null
    await createAuditLog({
      aksi: body.id ? 'UPDATE_BUNDLE' : 'CREATE_BUNDLE',
      target_type: 'bundle',
      target_id: bundleId,
      data_baru: data,
    })
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) throw new Error('ID wajib diisi')

    const { count } = await supabaseAdmin
      .from('bundle_order')
      .select('*', { count: 'exact', head: true })
      .eq('bundle_id', id)
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Paket sudah memiliki pesanan. Nonaktifkan saja agar tidak bisa dibeli.' },
        { status: 400 },
      )
    }

    const { error } = await supabaseAdmin.from('bundle').delete().eq('id', id)
    if (error) throw error
    await createAuditLog({ aksi: 'DELETE_BUNDLE', target_type: 'bundle', target_id: id })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
