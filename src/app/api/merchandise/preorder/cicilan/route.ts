import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { todayISO, formatRupiah } from '@/lib/utils'
import { kirimNotifPoTerverifikasi } from '@/lib/notifikasi-po'
import { createAuditLog } from '@/lib/queries'

type PoRow = {
  id: string
  no_po: string
  nama_pemesan: string
  kontak: string
  tipe_pemesan: string
  total: number
  status: string
  sudah_dibayar: number
  pembayaran_metode: string | null
  pembayaran_tipe: string | null
}

async function detailItems(poId: string) {
  const [{ data: poItems }, { data: merchandise }, { data: varian }] = await Promise.all([
    supabaseAdmin.from('merch_po_item').select('merchandise_id,varian_id,qty,harga_satuan,subtotal').eq('po_id', poId),
    supabaseAdmin.from('merchandise').select('id,nama'),
    supabaseAdmin.from('merch_varian').select('id,nama'),
  ])
  const merchMap = new Map((merchandise ?? []).map((m) => [m.id, m.nama]))
  const varianMap = new Map((varian ?? []).map((v) => [v.id, v.nama]))
  return (poItems ?? []).map((item) => ({
    nama_produk: merchMap.get(item.merchandise_id ?? '') ?? 'Item',
    ukuran: item.varian_id ? varianMap.get(item.varian_id) ?? null : null,
    qty: Number(item.qty),
    harga_satuan: Number(item.harga_satuan),
    subtotal: Number(item.subtotal),
  }))
}

// Hitung ulang sudah_dibayar + status dari cicilan yang tervalidasi.
async function sinkronPo(request: Request, poId: string, nominalBaru?: number): Promise<PoRow | null> {
  const { data: po } = await supabaseAdmin
    .from('merch_po')
    .select('id,no_po,nama_pemesan,kontak,tipe_pemesan,total,status,sudah_dibayar,pembayaran_metode,pembayaran_tipe')
    .eq('id', poId)
    .single()
  if (!po) return null

  const { data: rows } = await supabaseAdmin
    .from('merch_po_cicilan')
    .select('nominal,validated')
    .eq('po_id', poId)
  const totalValid = (rows ?? [])
    .filter((r) => r.validated === true)
    .reduce((s, r) => s + Number(r.nominal), 0)
  const total = Number(po.total)

  const payload: Record<string, unknown> = {
    sudah_dibayar: totalValid,
    updated_at: new Date().toISOString(),
  }
  if (po.status !== 'ditolak' && po.status !== 'batal') {
    if (totalValid >= total - 0.01) {
      payload.status = 'lunas'
      payload.verified_at = new Date().toISOString()
    } else if (totalValid > 0) {
      payload.status = 'dp_diterima'
    } else if (po.status === 'dp_diterima' || po.status === 'lunas') {
      payload.status = 'menunggu_verifikasi'
    }
  }

  const { data: updated } = await supabaseAdmin
    .from('merch_po')
    .update(payload)
    .eq('id', poId)
    .select('id,no_po,nama_pemesan,kontak,tipe_pemesan,total,status,sudah_dibayar,pembayaran_metode,pembayaran_tipe')
    .single()

  const result = (updated ?? { ...po, ...payload }) as PoRow

  if (nominalBaru !== undefined && result && (result.status === 'dp_diterima' || result.status === 'lunas')) {
    try {
      await kirimNotifPoTerverifikasi(request, {
        ...result,
        items: await detailItems(poId),
        nominal_cicilan: nominalBaru,
      })
    } catch (err) {
      console.error('Notifikasi PO gagal:', err)
    }
  }

  return result
}

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
    const { po_id, nominal, metode, bukti_url } = body

    if (!po_id || !nominal) {
      return NextResponse.json({ error: 'po_id dan nominal wajib diisi' }, { status: 400 })
    }

    const { data: po } = await supabaseAdmin
      .from('merch_po')
      .select('id,status,total')
      .eq('id', po_id)
      .single()
    if (!po) return NextResponse.json({ error: 'PO tidak ditemukan' }, { status: 404 })
    if (po.status === 'lunas' || po.status === 'batal') {
      return NextResponse.json({ error: 'PO sudah lunas atau dibatalkan' }, { status: 400 })
    }

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

    await sinkronPo(request, po_id, incoming)
    await createAuditLog({ aksi: 'CREATE_CICILAN', target_type: 'merch_po_cicilan', target_id: inserted.id, data_baru: inserted })

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
      .update({ validated, validated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    if (data?.po_id) {
      await sinkronPo(request, data.po_id, validated ? Number(data.nominal) : undefined)
    }
    await createAuditLog({ aksi: 'UPDATE_CICILAN', target_type: 'merch_po_cicilan', target_id: id, data_baru: data })

    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
