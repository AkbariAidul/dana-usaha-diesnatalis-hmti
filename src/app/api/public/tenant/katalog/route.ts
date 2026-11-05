import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getAcara,
  getHargaDasar,
  getKategoriBundleDiscount,
  getKategoriPilihan,
  getKategoriSewa,
  getPeriodeHarga,
} from '@/lib/queries'

export async function GET() {
  try {
    const [kategori, hargaDasar, periode, pilihan, bundles, acara, pendaftar] = await Promise.all([
      getKategoriSewa(),
      getHargaDasar(),
      getPeriodeHarga(),
      getKategoriPilihan(),
      getKategoriBundleDiscount(),
      getAcara(),
      supabaseAdmin
        .from('pendaftaran_tenant_pub')
        .select('kategori_sewa_id,jumlah_tenant,status')
        .not('status', 'in', '("ditolak","batal")'),
    ])
    if (pendaftar.error) throw pendaftar.error
    const terpakai: Record<string, number> = {}
    for (const row of pendaftar.data ?? []) {
      if (!row.kategori_sewa_id) continue
      terpakai[row.kategori_sewa_id] = (terpakai[row.kategori_sewa_id] ?? 0) + Number(row.jumlah_tenant ?? 1)
    }
    return NextResponse.json({ kategori, hargaDasar, periode, pilihan, bundles, acara, terpakai })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
