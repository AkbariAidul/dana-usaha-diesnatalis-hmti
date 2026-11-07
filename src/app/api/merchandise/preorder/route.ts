import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { kirimNotifPoTerverifikasi } from '@/lib/notifikasi-po'
import { buatQrPayload } from '@/lib/link-token'
import { createAuditLog } from '@/lib/queries'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('merch_po')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error

    const list = data ?? []
    const ids = list.map((p) => p.id)
    const [{ data: items }, { data: varian }, { data: pengurus }, { data: merchandise }, { data: modalItems }] = await Promise.all([
      ids.length ? supabaseAdmin.from('merch_po_item').select('*').in('po_id', ids) : Promise.resolve({ data: [] }),
      supabaseAdmin.from('merch_varian').select('id,nama'),
      supabaseAdmin.from('pengurus').select('id,nama,divisi'),
      supabaseAdmin.from('merchandise').select('id,nama'),
      supabaseAdmin.from('merch_modal_item').select('harga'),
    ])

    const varianMap = new Map((varian ?? []).map((v) => [v.id, v.nama]))
    const pengurusMap = new Map((pengurus ?? []).map((p) => [p.id, p]))
    const merchandiseMap = new Map((merchandise ?? []).map((m) => [m.id, m.nama]))
    const modalSatuan = (modalItems ?? []).reduce((sum, item) => sum + Number(item.harga), 0)

    const result = list.map((po) => {
      const poItems = (items ?? [])
        .filter((i) => i.po_id === po.id)
        .map((i) => ({
          ...i,
          merchandise: i.merchandise_id ? { nama: merchandiseMap.get(i.merchandise_id) ?? '' } : null,
          varian: i.varian_id ? { nama: varianMap.get(i.varian_id) ?? '' } : null,
        }))
      const totalQty = poItems.reduce((sum, item) => sum + Number(item.qty), 0)
      const modalTotal = modalSatuan * totalQty
      return {
        ...po,
        qr: buatQrPayload('po', po.no_po),
        pengurus: po.pengurus_id ? pengurusMap.get(po.pengurus_id) ?? null : null,
        items: poItems,
        modal_satuan: modalSatuan,
        modal_total: modalTotal,
        keuntungan: Number(po.total) - modalTotal,
      }
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('PreOrder error:', err)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Generate PO number
    const { data: existingData } = await supabaseAdmin
      .from('merch_po')
      .select('no_po')
    
    const maxNum = ((existingData as Record<string, unknown>[] ?? []) as { no_po: string }[]).reduce((m: number, p: { no_po: string }) => {
      const n = Number(/(\d+)$/.exec(p.no_po)?.[1] ?? 0)
      return n > m ? n : m
    }, 0)
    const noPo = `PO-${String(maxNum + 1).padStart(4, '0')}`
    
    const { data, error } = await supabaseAdmin
      .from('merch_po')
      .insert({
        no_po: noPo,
        nama_pemesan: body.nama_pemesan,
        kontak: body.kontak,
        tipe_pemesan: body.tipe_pemesan || 'Umum',
        harga_per_item: body.harga_per_item || 75000,
        total: body.total || 75000,
        status: 'menunggu_verifikasi',
      })
      .select()
      .single()
    
    if (error) throw error
    await createAuditLog({ aksi: 'CREATE_PREORDER', target_type: 'merch_po', target_id: data.id, data_baru: data })
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, status } = body
    const allowed = ['menunggu_verifikasi', 'dp_diterima', 'lunas', 'ditolak', 'batal']
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    const { data: current } = await supabaseAdmin
      .from('merch_po')
      .select('total,no_po,nama_pemesan,kontak,tipe_pemesan,sudah_dibayar,pembayaran_metode,pembayaran_tipe')
      .eq('id', id)
      .single()
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const nominalCicilan = body.nominal_cicilan ? Number(body.nominal_cicilan) : null
    const payload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }
    if (body.catatan_admin !== undefined) payload.catatan_admin = body.catatan_admin
    if (status === 'lunas') {
      payload.verified_at = new Date().toISOString()
      payload.sudah_dibayar = Number(current.total)
    }
    if (status === 'dp_diterima') {
      payload.verified_at = new Date().toISOString()
      payload.sudah_dibayar = Math.round(Number(current.total) * 0.25)
    }
    if (status === 'ditolak' || status === 'batal') {
      await supabaseAdmin
        .from('merch_po_cicilan')
        .delete()
        .eq('po_id', id)
        .eq('validated', false)
      const { data: validCicilan } = await supabaseAdmin
        .from('merch_po_cicilan')
        .select('nominal')
        .eq('po_id', id)
        .eq('validated', true)
      payload.sudah_dibayar = (validCicilan ?? []).reduce((sum, c) => sum + Number(c.nominal), 0)
    }

    const { data, error } = await supabaseAdmin
      .from('merch_po')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    await createAuditLog({ aksi: 'UPDATE_PREORDER', target_type: 'merch_po', target_id: id, data_baru: data })

    // Fetch items for notification
    const { data: poItems } = await supabaseAdmin
      .from('merch_po_item')
      .select('merchandise_id,varian_id,qty,harga_satuan,subtotal')
      .eq('po_id', id)

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
      qty: Number(item.qty),
      harga_satuan: Number(item.harga_satuan),
      subtotal: Number(item.subtotal),
    }))

    if (status === 'dp_diterima' || status === 'lunas') {
      try {
        await kirimNotifPoTerverifikasi(request, {
          ...data,
          items: itemDetails,
          nominal_cicilan: nominalCicilan,
        })
      } catch (notifError) {
        console.error('Notifikasi PO gagal:', notifError)
      }
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}