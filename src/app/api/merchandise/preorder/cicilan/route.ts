import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { todayISO } from '@/lib/utils'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const po_id = url.searchParams.get('po_id')
    if (!po_id) return NextResponse.json({ error: 'po_id diperlukan' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('merch_po_cicilan')
      .select('*')
      .eq('po_id', po_id)
      .order('tanggal_bayar', { ascending: true })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { po_id, nominal, metode, bukti_url, keterangan } = body

    if (!po_id || !nominal) {
      return NextResponse.json({ error: 'po_id dan nominal wajib diisi' }, { status: 400 })
    }

    // Validasi PO ada
    const { data: po } = await supabaseAdmin
      .from('merch_po')
      .select('id,status,total')
      .eq('id', po_id)
      .single()
    if (!po) return NextResponse.json({ error: 'PO tidak ditemukan' }, { status: 404 })
    if (po.status === 'lunas' || po.status === 'batal') {
      return NextResponse.json({ error: 'PO sudah lunas atau dibatalkan' }, { status: 400 })
    }

    // Hitung total sudah dibayar
    const { data: existing } = await supabaseAdmin
      .from('merch_po_cicilan')
      .select('nominal')
      .eq('po_id', po_id)
      .eq('validated', true)

    const totalSudah = (existing ?? []).reduce((s, c) => s + Number(c.nominal), 0)
    const totalPo = Number(po.total)
    const sisa = totalPo - totalSudah
    const incoming = Number(nominal)

    if (incoming <= 0) return NextResponse.json({ error: 'Nominal harus lebih dari 0' }, { status: 400 })
    if (totalSudah + incoming > totalPo + 0.01) {
      return NextResponse.json({ error: `Nominal melebihi sisa pembayaran (${formatRupiah(sisa)})` }, { status: 400 })
    }

    const { count } = await supabaseAdmin
      .from('merch_po_cicilan')
      .select('*', { count: 'exact', head: true })
    const no = `CCL-${String((count ?? 0) + 1).padStart(4, '0')}`

    const { data: inserted, error } = await supabaseAdmin
      .from('merch_po_cicilan')
      .insert({
        po_id,
        no_transaksi: no,
        nominal: incoming,
        metode: metode || 'QRIS',
        bukti_url: bukti_url || null,
        validated: true,
        validated_by: 'Admin',
        validated_at: todayISO(),
        tanggal_bayar: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    // Update sudah_dibayar di PO
    const baru = totalSudah + incoming
    await supabaseAdmin
      .from('merch_po')
      .update({ sudah_dibayar: baru, updated_at: new Date().toISOString() })
      .eq('id', po_id)

    // Auto-lunas jika sudah cukup
    if (baru >= totalPo - 0.01 && po.status !== 'lunas') {
      await supabaseAdmin
        .from('merch_po')
        .update({
          status: 'lunas',
          sudah_dibayar: totalPo,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', po_id)
    }

    return NextResponse.json(inserted, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, validated } = body
    if (!id || validated === undefined) {
      return NextResponse.json({ error: 'id dan validated wajib diisi' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('merch_po_cicilan')
      .update({ validated, validated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function formatRupiah(n: number) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}
