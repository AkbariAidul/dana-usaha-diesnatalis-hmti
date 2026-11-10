import { NextResponse } from 'next/server'

/**
 * Log detail error di server, balas pesan generik + requestId ke klien.
 * Dipakai di route publik/cron agar stack trace / pesan DB tidak bocor.
 */
export function apiError(
  err: unknown,
  message = 'Terjadi kesalahan. Coba lagi sebentar lagi.',
  status = 500,
) {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`
  console.error(`[api:${requestId}]`, err)
  return NextResponse.json({ error: message, requestId }, { status })
}

/**
 * Error dari RPC transaksional (RAISE EXCEPTION) memakai SQLSTATE P0001.
 * Pesannya memang untuk pengguna, jadi boleh ditampilkan.
 */
export function rpcError(err: unknown, fallback = 'Permintaan tidak dapat diproses') {
  const e = err as { code?: string; message?: string } | null
  if (e?.code === 'P0001') {
    return NextResponse.json({ error: e.message || fallback }, { status: 400 })
  }
  return apiError(err)
}
