import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTicketPenjualan } from '@/lib/queries'
import { createAuditLog } from '@/lib/queries'

export async function GET() {
  try {
    const data = await getTicketPenjualan()
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { ids }: { ids: string[] } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 })
    }
    // Ambil data sebelum dihapus
    const { data: orders } = await supabaseAdmin
      .from('pesanan_tiket')
      .select('id,tiket_tipe_id,jumlah,status')
      .in('id', ids)
    const lunasOrders = (orders ?? []).filter((o) => o.status === 'lunas')

    // Hapus tiket yang sudah dikeluarkan
    for (const order of lunasOrders) {
      if (order.tiket_tipe_id && order.jumlah > 0) {
        await supabaseAdmin.from('tiket_issued').delete().eq('pesanan_id', order.id)
        const { data: tipe } = await supabaseAdmin.from('tiket_tipe').select('kuota,terjual').eq('id', order.tiket_tipe_id).maybeSingle()
        if (tipe) {
          const newTerjual = Math.max(0, Number(tipe.terjual ?? 0) - Number(order.jumlah))
          await supabaseAdmin.from('tiket_tipe').update({ terjual: newTerjual }).eq('id', order.tiket_tipe_id)
        }
      }
    }

    // Update status jadi batal (bukan hard delete agar audit log tetap ada)
    const { error } = await supabaseAdmin
      .from('pesanan_tiket')
      .update({ status: 'batal', updated_at: new Date().toISOString() })
      .in('id', ids)
    if (error) throw error

    for (const order of orders ?? []) {
      await createAuditLog({ aksi: 'DELETE_PESANAN_TIKET', target_type: 'pesanan_tiket', target_id: order.id, data_lama: order })
    }
    return NextResponse.json({ success: true, deleted: ids.length })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
