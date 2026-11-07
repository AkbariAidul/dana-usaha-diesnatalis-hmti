import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { OWNER_NAME } from '@/lib/auth'
import { createAuditLog } from '@/lib/queries'
import { loadDashboardUsers, saveDashboardUsers, type DashboardUserRecord } from '@/lib/dashboard-users'

async function currentUserName() {
  const store = await cookies()
  const raw = store.get('dashboard_user')?.value
  if (!raw) return null
  for (const value of [raw, decodeURIComponent(raw)]) {
    try {
      const parsed = JSON.parse(value) as { name?: string }
      if (parsed?.name) return parsed.name
    } catch {
      // coba bentuk berikutnya
    }
  }
  return null
}

async function ownerName() {
  const users = await loadDashboardUsers()
  return users.find((user) => user.owner)?.name ?? OWNER_NAME
}

function forbidden() {
  return NextResponse.json({ error: 'Hanya pemilik yang dapat mengelola user' }, { status: 403 })
}

export async function GET() {
  try {
    const name = await currentUserName()
    if (!name || name !== (await ownerName())) return forbidden()
    return NextResponse.json(await loadDashboardUsers())
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const name = await currentUserName()
    const owner = await ownerName()
    if (!name || name !== owner) return forbidden()

    const body = await request.json()
    const input = Array.isArray(body?.users) ? (body.users as unknown[]) : null
    if (!input) return NextResponse.json({ error: 'Data user tidak valid' }, { status: 400 })

    const users: DashboardUserRecord[] = []
    for (const item of input) {
      if (typeof item !== 'object' || item === null) {
        return NextResponse.json({ error: 'Data user tidak valid' }, { status: 400 })
      }
      const row = item as Record<string, unknown>
      const userName = String(row.name ?? '').trim()
      const pin = String(row.pin ?? '').trim()
      const role = row.role === 'viewer' ? 'viewer' : 'pengelola'
      if (!userName) return NextResponse.json({ error: 'Nama user wajib diisi' }, { status: 400 })
      if (!/^\d{4,12}$/.test(pin)) {
        return NextResponse.json({ error: `PIN ${userName} harus 4-12 angka` }, { status: 400 })
      }
      users.push({ name: userName, pin, role, aktif: row.aktif !== false, owner: false })
    }

    if (users.length === 0) return NextResponse.json({ error: 'Minimal satu user' }, { status: 400 })

    const names = users.map((user) => user.name.toLowerCase())
    const pins = users.map((user) => user.pin)
    if (new Set(names).size !== names.length) {
      return NextResponse.json({ error: 'Nama user tidak boleh sama' }, { status: 400 })
    }
    if (new Set(pins).size !== pins.length) {
      return NextResponse.json({ error: 'PIN user tidak boleh sama' }, { status: 400 })
    }

    const ownerIndex = users.findIndex((user) => user.name === owner)
    if (ownerIndex === -1) {
      return NextResponse.json({ error: `Akun pemilik ${owner} tidak boleh dihapus atau diganti nama` }, { status: 400 })
    }
    if (users[ownerIndex].role !== 'pengelola' || !users[ownerIndex].aktif) {
      return NextResponse.json({ error: 'Akun pemilik harus pengelola dan aktif' }, { status: 400 })
    }
    users[ownerIndex].owner = true

    await saveDashboardUsers(users)
    await createAuditLog({
      aksi: 'UPDATE_DASHBOARD_USERS',
      target_type: 'pengaturan_umum',
      target_id: 'dashboard_users',
      data_baru: { count: users.length, names: users.map((user) => user.name) },
      user_name: name,
    })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
