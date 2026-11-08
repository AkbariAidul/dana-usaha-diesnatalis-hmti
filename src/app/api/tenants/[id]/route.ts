import { NextResponse } from 'next/server'
import { getTenantById, updateTenant, deleteTenant, createAuditLog } from '@/lib/queries'
import { getSessionUser } from '@/lib/session-server'

// Fields yang boleh di-update via PATCH; field sensitif (status, pembayaran) dilindungi
const ALLOWED_PATCH_FIELDS = new Set([
  'nama_usaha', 'kontak', 'email', 'keterangan',
  'venue_checked_in_at', 'venue_checked_in_by',
])

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await getTenantById(id)
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const body = await request.json()
    // Whitelist: hanya allow field yang aman, blokir field sensitif
    const filtered: Record<string, unknown> = {}
    for (const key of Object.keys(body)) {
      if (!ALLOWED_PATCH_FIELDS.has(key)) continue
      filtered[key] = body[key]
    }
    if (Object.keys(filtered).length === 0) {
      return NextResponse.json({ error: 'Tidak ada field yang valid untuk diupdate' }, { status: 400 })
    }
    const old = await getTenantById(id)
    const updated = await updateTenant(id, filtered as Parameters<typeof updateTenant>[1])
    await createAuditLog({ aksi: 'UPDATE_TENANT', target_type: 'tenants', target_id: id, data_lama: old, data_baru: updated, user_name: session.name })
    return NextResponse.json(updated)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const old = await getTenantById(id)
    await deleteTenant(id)
    await createAuditLog({ aksi: 'DELETE_TENANT', target_type: 'tenants', target_id: id, data_lama: old })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
