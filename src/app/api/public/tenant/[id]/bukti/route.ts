import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const buktiUrl = String(body.bukti_url ?? '').trim()
    if (!buktiUrl) {
      return NextResponse.json({ error: 'Bukti pembayaran wajib diupload' }, { status: 400 })
    }
    const { data: pendaftaran } = await supabaseAdmin
      .from('pendaftaran_tenant_pub')
      .select('id,harga_akhir,dp_wajib,sudah_dibayar,pembayaran_tipe')
      .eq('id', id)
      .maybeSingle()
    if (!pendaftaran) {
      return NextResponse.json({ error: 'Pendaftaran tidak ditemukan' }, { status: 404 })
    }
    const total = Number(pendaftaran.harga_akhir)
    const sudah = Number(pendaftaran.sudah_dibayar ?? 0)
    const tipe = body.pembayaran_tipe === 'lunas' ? 'lunas' : 'nyicil'
    const nominal = Number(body.nominal_bayar)
    if (!Number.isFinite(nominal) || nominal <= 0) {
      return NextResponse.json({ error: 'Nominal pembayaran tidak valid' }, { status: 400 })
    }
    if (nominal > total - sudah + 0.01) {
      return NextResponse.json({ error: 'Nominal melebihi sisa pembayaran' }, { status: 400 })
    }
    if (sudah + nominal < Math.ceil(total / 2) - 0.01) {
      return NextResponse.json({ error: 'Pembayaran pertama minimal 50% dari total' }, { status: 400 })
    }
    const { error } = await supabaseAdmin
      .from('pendaftaran_tenant_pub')
      .update({
        bukti_url: buktiUrl,
        status: 'menunggu_verifikasi',
        pembayaran_tipe: tipe,
        nominal_bayar: nominal,
      })
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
