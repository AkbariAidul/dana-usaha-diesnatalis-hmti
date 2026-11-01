import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getPeriodeHarga, getHargaDasar, getFaktorHarga, getAcara } from '@/lib/queries'
import { hitungHarga, periodeDariTanggal } from '@/lib/types'
import { todayISO } from '@/lib/utils'
import { signRef } from '@/lib/link-token'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('pendaftaran_tenant_pub')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const tglDaftar = todayISO()
    const [periods, hargaDasar, faktor, acara] = await Promise.all([
      getPeriodeHarga(),
      getHargaDasar(),
      getFaktorHarga(),
      getAcara(),
    ])
    const periode = periodeDariTanggal(tglDaftar, periods)
    if (!periode) {
      return NextResponse.json({ error: 'Tanggal daftar di luar periode open tenant' }, { status: 400 })
    }
    const hargaDasarItem = hargaDasar.find(
      (h) => h.kategori_sewa_id === body.kategori_sewa_id && h.jenis_usaha === body.jenis_usaha && h.periode === periode
    )
    if (!hargaDasarItem) {
      return NextResponse.json({ error: 'Harga untuk kategori dan periode ini belum diatur' }, { status: 400 })
    }
    const faktorAsal = faktor.find((f) => f.tipe === 'asal' && f.nilai === body.asal)?.multiplier ?? 1
    const faktorLokasi = faktor.find((f) => f.tipe === 'lokasi' && f.nilai === body.lokasi)?.multiplier ?? 1
    const harga = hitungHarga(hargaDasarItem.harga, faktorAsal, faktorLokasi)

    const existing = await supabaseAdmin.from('pendaftaran_tenant_pub').select('kode_pendaftaran')
    const maxKode = (existing.data || []).reduce((m: number, t: { kode_pendaftaran: string }) => {
      const n = Number(/(\d+)$/.exec(t.kode_pendaftaran)?.[1] ?? 0)
      return n > m ? n : m
    }, 0)
    const kode = `TP-${String(maxKode + 1).padStart(4, '0')}`
    const payload = {
      ...body,
      tgl_daftar: tglDaftar,
      tgl_acara: acara?.tanggal_acara ?? null,
      periode_daftar: periode,
      harga_akhir: harga,
      dp_wajib: Math.ceil(harga / 2),
      kode_pendaftaran: kode,
      status: 'menunggu_verifikasi',
      sudah_dibayar: 0,
    }
    const { data, error } = await supabaseAdmin.from('pendaftaran_tenant_pub').insert(payload).select().single()
    if (error) throw error
    return NextResponse.json({ ...data, t: signRef('tenant', data.kode_pendaftaran) }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
