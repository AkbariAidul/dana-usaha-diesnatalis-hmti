import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { kirimNotifTerverifikasi } from '@/lib/notifikasi-tiket'
import { createAuditLog } from '@/lib/queries'
import { apiError } from '@/lib/api-error'

const STATUS_VALID = new Set(['menunggu_verifikasi', 'lunas', 'ditolak', 'batal'])

async function terbitkanTiket(data: {
  id: string
  tiket_tipe_id: string
  jumlah: number
}) {
  const { data: existing } = await supabaseAdmin
    .from('tiket_issued')
    .select('id')
    .eq('pesanan_id', data.id)
    .limit(1)
  if (existing?.length) return

  const { data: tipeData } = await supabaseAdmin
    .from('tiket_tipe')
    .select('kuota,terjual')
    .eq('id', data.tiket_tipe_id)
    .maybeSingle()

  if (tipeData) {
    await supabaseAdmin
      .from('tiket_tipe')
      .update({ terjual: Number(tipeData.terjual ?? 0) + Number(data.jumlah) })
      .eq('id', data.tiket_tipe_id)
  }

  for (let i = 0; i < data.jumlah; i++) {
    await supabaseAdmin.from('tiket_issued').insert({
      pesanan_id: data.id,
      kode_qr: crypto.randomUUID().replace(/-/g, ''),
      kode_tampil: `DN2026-${String(Date.now()).slice(-6)}-${String(i + 1).padStart(3, '0')}`,
      status: 'belum_divalidasi',
    })
  }
}

async function lepasTiket(data: { id: string; tiket_tipe_id: string; jumlah: number }) {
  const { data: issued } = await supabaseAdmin
    .from('tiket_issued')
    .select('id')
    .eq('pesanan_id', data.id)
    .limit(1)
  if (!issued?.length) return

  await supabaseAdmin.from('tiket_issued').delete().eq('pesanan_id', data.id)

  const { data: tipe } = await supabaseAdmin
    .from('tiket_tipe')
    .select('terjual')
    .eq('id', data.tiket_tipe_id)
    .maybeSingle()
  if (tipe) {
    await supabaseAdmin
      .from('tiket_tipe')
      .update({ terjual: Math.max(0, Number(tipe.terjual ?? 0) - Number(data.jumlah)) })
      .eq('id', data.tiket_tipe_id)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, status, catatan_admin } = body

    if (!id) {
      return NextResponse.json({ error: 'ID pesanan wajib diisi' }, { status: 400 })
    }
    if (!STATUS_VALID.has(status)) {
      return NextResponse.json({ error: 'Status verifikasi tidak valid' }, { status: 400 })
    }

    const { data: sebelum } = await supabaseAdmin
      .from('pesanan_tiket')
      .select('status,bundle_order_id')
      .eq('id', id)
      .maybeSingle()

    if (sebelum?.bundle_order_id) {
      return NextResponse.json(
        { error: 'Pesanan ini bagian dari Paket Combo. Verifikasi lewat menu Pesanan Paket.' },
        { status: 400 },
      )
    }

    const { data, error } = await supabaseAdmin
      .from('pesanan_tiket')
      .update({
        status,
        catatan_admin,
        verified_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    await createAuditLog({ aksi: 'VERIFIKASI_TIKET', target_type: 'pesanan_tiket', target_id: id, data_baru: data })

    if (status === 'lunas') {
      await terbitkanTiket(data)
    } else if (sebelum?.status === 'lunas') {
      await lepasTiket(data)
    }

    if (status === 'lunas' && sebelum?.status !== 'lunas') {
      try {
        const { data: tipe } = await supabaseAdmin
          .from('tiket_tipe')
          .select('nama')
          .eq('id', data.tiket_tipe_id)
          .maybeSingle()
        await kirimNotifTerverifikasi(request, data, tipe?.nama || 'Tiket')
      } catch (err) {
        console.error('Gagal mengirim notifikasi WhatsApp:', err)
      }
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    return apiError(err)
  }
}
