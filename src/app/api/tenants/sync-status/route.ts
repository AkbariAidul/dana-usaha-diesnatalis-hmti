import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createAuditLog } from '@/lib/queries'

/**
 * POST /api/tenants/sync-status
 * Scan semua tenant aktif dan update status Menunggak jika sudah lewat tanggal acara
 * tapi belum lunas. Bisa dipanggil manual atau dari cron job.
 */
export async function POST() {
  try {
    const { data: tenants, error } = await supabaseAdmin
      .from('tenants')
      .select('id, harga_akhir, sudah_dibayar, dp_wajib, tgl_acara, status')
      .not('status', 'in', '("lunas","batal")')

    if (error) throw error

    const today = new Date()
    let updated = 0

    for (const t of tenants ?? []) {
      let newStatus = t.status

      if (t.sudah_dibayar >= t.harga_akhir) {
        newStatus = 'lunas'
      } else if (t.tgl_acara && today > new Date(t.tgl_acara) && t.sudah_dibayar < t.harga_akhir) {
        newStatus = 'menunggak'
      } else if (t.sudah_dibayar >= t.dp_wajib) {
        newStatus = 'cicil'
      } else if (t.sudah_dibayar > 0) {
        newStatus = 'dp'
      } else {
        newStatus = 'daftar'
      }

      if (newStatus !== t.status) {
        await supabaseAdmin
          .from('tenants')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', t.id)
        updated++
      }
    }

    await createAuditLog({ aksi: 'SYNC_STATUS_TENANT', data_baru: { total_scanned: tenants?.length ?? 0, total_updated: updated } })
    return NextResponse.json({ success: true, scanned: tenants?.length ?? 0, updated })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
