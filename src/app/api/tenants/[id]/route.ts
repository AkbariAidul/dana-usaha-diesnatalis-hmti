import { NextResponse } from 'next/server'
import { getTenantById, updateTenant, deleteTenant, createAuditLog } from '@/lib/queries'

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
  try {
    const { id } = await params
    const body = await request.json()
    const old = await getTenantById(id)
    const updated = await updateTenant(id, body)
    await createAuditLog({ aksi: 'UPDATE_TENANT', target_type: 'tenants', target_id: id, data_lama: old, data_baru: updated })
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
