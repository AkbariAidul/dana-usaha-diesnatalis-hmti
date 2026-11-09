import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionUser } from '@/lib/session-server'

/**
 * Mengembalikan daftar path file yang aktif (masih direferensikan) dari semua tabel.
 */
async function getActivePaths(): Promise<Set<string>> {
  const active = new Set<string>()
  const addUrls = async (table: string, col: string) => {
    const { data } = await supabaseAdmin.from(table).select(col)
    for (const row of (data ?? []) as unknown[]) {
      const raw = (row as Record<string, unknown>)[col] as string | null | undefined
      if (!raw) continue
      const p = extractPath(raw)
      if (p) active.add(p)
    }
  }
  // Pendaftaran tenant publik
  await addUrls('pendaftaran_tenant_pub', 'bukti_url')
  // Pembayaran tenant
  await addUrls('pembayaran', 'bukti_url')
  // Transaksi kasir
  await addUrls('kasir_transaksi', 'bukti_url')
  // Data tenant (jika ada)
  await addUrls('tenants', 'bukti_url')
  return active
}

function extractPath(url: string): string | null {
  try {
    const u = new URL(url)
    const p = u.pathname.split('?')[0]
    return p.startsWith('/') ? p.slice(1) : null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionUser()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const bucket = String(body.bucket ?? 'bukti')
    const prefix = String(body.prefix ?? '')

    // ── Step 1: List semua file di bucket ──────────────────────────────
    const allFiles: Array<{ name: string }> = []
    let offset = 0
    while (true) {
      const limit = 500
      const { data: page, error: listErr } = await supabaseAdmin.storage
        .from(bucket)
        .list(prefix || undefined, { limit, offset })
      if (listErr) throw listErr
      if (!page || page.length === 0) break
      allFiles.push(...page)
      if (page.length < limit) break
      offset += limit
    }

    if (allFiles.length === 0) {
      return NextResponse.json({ removed: 0, failed: 0, totalScanned: 0, note: 'Bucket kosong' })
    }

    // ── Step 2: Kumpulkan path yang masih aktif ────────────────────────
    const activePaths = await getActivePaths()

    // ── Step 3: Hitung mana yang bisa dihapus ─────────────────────────
    type FileItem = { path: string }
    const candidates: FileItem[] = []
    for (const f of allFiles) {
      const fullPath = prefix ? `${prefix}${f.name}` : f.name
      if (activePaths.has(fullPath)) continue
      candidates.push({ path: fullPath })
    }

    // ── Step 4: Hapus sekaligus (batch remove) ────────────────────────
    if (candidates.length === 0) {
      return NextResponse.json({
        removed: 0,
        failed: 0,
        totalScanned: allFiles.length,
        orphaned: 0,
        note: 'Tidak ada file sampah',
      })
    }

    const pathsOnly = candidates.map((c) => c.path)
    const { error: delErr } = await supabaseAdmin.storage.from(bucket).remove(pathsOnly)

    if (delErr) {
      console.error('[cleanup] Gagal hapus batch:', delErr.message, 'path sample:', pathsOnly[0])
      return NextResponse.json({
        removed: 0,
        failed: candidates.length,
        totalScanned: allFiles.length,
        orphaned: candidates.length,
        error: delErr.message,
      }, { status: 500 })
    }

    return NextResponse.json({
      removed: candidates.length,
      failed: 0,
      totalScanned: allFiles.length,
      orphaned: candidates.length,
      active: activePaths.size,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
