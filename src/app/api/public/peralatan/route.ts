import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getPeralatanMeta } from '@/lib/peralatan'

export async function GET() {
  try {
    const { data } = await supabaseAdmin.from('peralatan').select('id,nama').order('nama')
    const meta = await getPeralatanMeta()
    return NextResponse.json(
      (data ?? []).map((item: { id: string; nama: string }) => ({
        id: item.id,
        nama: item.nama,
        harga_sewa: Number(meta[item.id]?.harga_sewa ?? 0),
      })),
    )
  } catch {
    return NextResponse.json([])
  }
}
