import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('merch_po')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error

    const list = data ?? []
    const ids = list.map((p) => p.id)
    const [{ data: items }, { data: varian }, { data: pengurus }] = await Promise.all([
      ids.length ? supabaseAdmin.from('merch_po_item').select('*').in('po_id', ids) : Promise.resolve({ data: [] }),
      supabaseAdmin.from('merch_varian').select('id,nama'),
      supabaseAdmin.from('pengurus').select('id,nama,divisi'),
    ])

    const varianMap = new Map((varian ?? []).map((v) => [v.id, v.nama]))
    const pengurusMap = new Map((pengurus ?? []).map((p) => [p.id, p]))

    const result = list.map((po) => ({
      ...po,
      pengurus: po.pengurus_id ? pengurusMap.get(po.pengurus_id) ?? null : null,
      items: (items ?? [])
        .filter((i) => i.po_id === po.id)
        .map((i) => ({ ...i, varian: i.varian_id ? { nama: varianMap.get(i.varian_id) ?? '' } : null })),
    }))

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
      .select('total')
      .eq('id', id)
      .single()
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
      payload.sudah_dibayar = 0
    }

    const { data, error } = await supabaseAdmin
      .from('merch_po')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}