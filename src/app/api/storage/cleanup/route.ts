import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionUser } from '@/lib/session-server'

export async function POST(request: Request) {
  try {
    const session = await getSessionUser()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const bucket = String(body.bucket ?? 'bukti')
    const prefix = body.prefix ? String(body.prefix) : ''

    // Ambil semua path file di bucket + prefix
    const { data: files, error: listErr } = await supabaseAdmin.storage.from(bucket).list(prefix || '', { limit: 1000, offset: 0 })
    if (listErr) throw listErr
    if (!files || files.length === 0) {
      return NextResponse.json({ removed: 0, kept: 0 })
    }

    // Kumpulkan semua path yang masih direferensikan oleh database
    const activePaths = new Set<string>()
    const collectPaths = (urls: (string | null)[]) => { for (const u of urls) { if (!u) continue; const p = extractPath(u); if (p) activePaths.add(p) } }
    const { data: pendaftaran } = await supabaseAdmin.from('pendaftaran_tenant_pub').select('bukti_url')
    collectPaths((pendaftaran ?? []).map((r) => r.bukti_url as string | null))
    const { data: payments } = await supabaseAdmin.from('pembayaran').select('bukti_url')
    collectPaths((payments ?? []).map((r) => r.bukti_url as string | null))
    const { data: kasir } = await supabaseAdmin.from('kasir_transaksi').select('bukti_url')
    collectPaths((kasir ?? []).map((r) => r.bukti_url as string | null))
    const { data: tenants } = await supabaseAdmin.from('tenants').select('bukti_url')
    collectPaths((tenants ?? []).map((r) => r.bukti_url as string | null))

    const toRemove = files
      .map((f) => `${prefix}${f.name}`)
      .filter((p) => !activePaths.has(p))

    let removed = 0
    let failed = 0
    for (const path of toRemove) {
      const { error: delErr } = await supabaseAdmin.storage.from(bucket).remove([path])
      if (delErr) { console.error('Gagal hapus:', path, delErr.message); failed++ }
      else removed++
    }
    return NextResponse.json({ removed, failed, totalScanned: files.length, activePaths: activePaths.size })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function extractPath(url: string): string | null {
  try {
    const u = new URL(url)
    const p = u.pathname.split('?')[0]
    return p.startsWith('/') ? p.slice(1) : null
  } catch { return null }
}
