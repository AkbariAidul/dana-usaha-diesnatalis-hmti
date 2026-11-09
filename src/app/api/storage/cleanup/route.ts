import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionUser } from '@/lib/session-server'

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
  await addUrls('pendaftaran_tenant_pub', 'bukti_url')
  await addUrls('pembayaran', 'bukti_url')
  await addUrls('kasir_transaksi', 'bukti_url')
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

/** List semua file (recursive) di dalam bucket dengan prefix tertentu */
async function listAllFiles(
  bucket: string,
  prefix = '',
  depth = 0,
): Promise<Array<{ path: string; name: string; size?: number }>> {
  if (depth > 10) return []
  const results: Array<{ path: string; name: string; size?: number }> = []
  let offset = 0
  const limit = 500
  while (true) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix || undefined, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw error
    if (!data || data.length === 0) break
    for (const item of data) {
      if (!item.id) {
        // folder — recurse
        const childPrefix = prefix ? `${prefix}/${item.name}` : item.name
        const nested = await listAllFiles(bucket, childPrefix, depth + 1)
        results.push(...nested)
      } else {
        const path = prefix ? `${prefix}/${item.name}` : item.name
        results.push({ path, name: item.name, size: Number(item.metadata?.size ?? 0) })
      }
    }
    if (data.length < limit) break
    offset += limit
  }
  return results
}

export async function POST(request: Request) {
  try {
    const session = await getSessionUser()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const bucket = String(body.bucket ?? 'bukti')

    // ── Langkah 1: Ambil semua file (termasuk subfolder) ───────────────
    const allFiles = await listAllFiles(bucket)
    if (allFiles.length === 0) {
      return NextResponse.json({ removed: 0, failed: 0, totalScanned: 0, note: 'Bucket kosong' })
    }

    // ── Langkah 2: Ambil path aktif dari database ──────────────────────
    const activePaths = await getActivePaths()

    // ── Langkah 3: Cari file sampah ────────────────────────────────────
    const orphans = allFiles.filter((f) => !activePaths.has(f.path))

    if (orphans.length === 0) {
      return NextResponse.json({
        removed: 0, failed: 0, totalScanned: allFiles.length,
        orphaned: 0, activePaths: activePaths.size,
        note: 'Tidak ada file sampah',
      })
    }

    console.log(`[cleanup] bucket=${bucket}, scanned=${allFiles.length}, orphans=${orphans.length}, active=${activePaths.size}`)

    // ── Langkah 4: Hapus satu-satu (lebih reliable dari batch) ────────
    let removed = 0
    let failed = 0
    const failedPaths: string[] = []
    for (const f of orphans) {
      const { error } = await supabaseAdmin.storage.from(bucket).remove([f.path])
      if (error) {
        console.error('[cleanup] Gagal hapus:', f.path, error.message)
        failed++
        failedPaths.push(`${f.path} (${error.message})`)
      } else {
        removed++
      }
    }

    return NextResponse.json({
      removed,
      failed,
      totalScanned: allFiles.length,
      orphaned: orphans.length,
      activePaths: activePaths.size,
      failedPaths: failedPaths.slice(0, 10),
    })
  } catch (err: unknown) {
    console.error('[cleanup] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
