import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionUser } from '@/lib/session-server'
import { storagePathFromUrl } from '@/lib/storage'

// Semua kolom di database yang menyimpan URL file di bucket "bukti".
const URL_SOURCES: Array<[table: string, column: string]> = [
  ['pendaftaran_tenant_pub', 'bukti_url'],
  ['pembayaran', 'bukti_url'],
  ['kasir_transaksi', 'bukti_url'],
  ['pesanan_tiket', 'bukti_url'],
  ['merch_po', 'bukti_url'],
  ['merch_po_cicilan', 'bukti_url'],
  ['merchandise', 'gambar_url'],
  ['tiket_tipe', 'thumbnail_url'],
  ['kategori_sewa', 'thumbnail_url'],
  ['kategori_pilihan', 'gambar_url'],
  ['bundle', 'gambar_url'],
  ['bundle_order', 'bukti_url'],
]

const PAGE_SIZE = 1000

async function getActivePaths(): Promise<Set<string>> {
  const active = new Set<string>()
  for (const [table, column] of URL_SOURCES) {
    let from = 0
    while (true) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select(column)
        .order(column, { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      // Jangan pernah lanjut dengan daftar aktif yang tidak lengkap: cleanup
      // bisa menghapus file yang masih dipakai.
      if (error) throw new Error(`Gagal membaca ${table}.${column}: ${error.message}`)
      const rows = (data ?? []) as unknown[]
      for (const row of rows) {
        const raw = (row as Record<string, unknown>)[column] as string | null | undefined
        const path = storagePathFromUrl(raw)
        if (path) active.add(path)
      }
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }
  return active
}

type FileEntry = { path: string; size: number }

async function listAllFiles(
  bucket: string,
  prefix = '',
  depth = 0,
): Promise<FileEntry[]> {
  if (depth > 10) return []
  const results: FileEntry[] = []
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
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (!item.id) {
        results.push(...(await listAllFiles(bucket, path, depth + 1)))
      } else {
        results.push({ path, size: Number(item.metadata?.size ?? 0) })
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
    const dryRun = body.dryRun === true

    const allFiles = await listAllFiles(bucket)
    const activePaths = await getActivePaths()
    const orphans = allFiles.filter((f) => !activePaths.has(f.path))
    const orphanBytes = orphans.reduce((sum, f) => sum + f.size, 0)

    // Pratinjau: tidak menghapus apa pun.
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        totalScanned: allFiles.length,
        activePaths: activePaths.size,
        orphaned: orphans.length,
        orphanBytes,
        files: orphans.map((f) => f.path).slice(0, 100),
      })
    }

    if (activePaths.size === 0) {
      return NextResponse.json(
        { error: 'Cleanup dibatalkan: tidak ada file aktif yang terbaca dari database.' },
        { status: 409 },
      )
    }

    if (orphans.length === 0) {
      return NextResponse.json({
        removed: 0, failed: 0, totalScanned: allFiles.length,
        orphaned: 0, orphanBytes: 0, activePaths: activePaths.size,
        note: 'Tidak ada file sampah',
      })
    }

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
      orphanBytes,
      activePaths: activePaths.size,
      failedPaths: failedPaths.slice(0, 10),
    })
  } catch (err: unknown) {
    console.error('[cleanup] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
