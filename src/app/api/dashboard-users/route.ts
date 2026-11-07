import { NextResponse } from 'next/server'
import { OWNER_NAME } from '@/lib/auth'
import { createAuditLog } from '@/lib/queries'
import { getSessionUser } from '@/lib/session-server'
import {
  hashPin,
  loadDashboardUsers,
  saveDashboardUsers,
  type DashboardUserRecord,
} from '@/lib/dashboard-users'

async function ownerName() {
  const users = await loadDashboardUsers()
  return users.find((user) => user.owner)?.name ?? OWNER_NAME
}

function forbidden() {
  return NextResponse.json({ error: 'Hanya pemilik yang dapat mengelola user' }, { status: 403 })
}

function publicUser(user: DashboardUserRecord) {
  return {
    name: user.name,
    pin: '',
    has_pin: !!(user.pin || user.pin_hash),
    role: user.role,
    aktif: user.aktif,
    owner: user.owner === true,
  }
}

export async function GET() {
  try {
    const session = await getSessionUser()
    if (!session || session.name !== (await ownerName())) return forbidden()
    return NextResponse.json((await loadDashboardUsers()).map(publicUser))
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionUser()
    const owner = await ownerName()
    if (!session || session.name !== owner) return forbidden()

    const body = await request.json()
    const input = Array.isArray(body?.users) ? (body.users as unknown[]) : null
    if (!input) return NextResponse.json({ error: 'Data user tidak valid' }, { status: 400 })

    const existing = await loadDashboardUsers()
    const byName = new Map(existing.map((user) => [user.name.toLowerCase(), user]))
    const users: DashboardUserRecord[] = []
    const pins: string[] = []

    for (const item of input) {
      if (typeof item !== 'object' || item === null) {
        return NextResponse.json({ error: 'Data user tidak valid' }, { status: 400 })
      }
      const row = item as Record<string, unknown>
      const userName = String(row.name ?? '').trim()
      const pin = String(row.pin ?? '').trim()
      const role = row.role === 'viewer' ? 'viewer' : 'pengelola'
      if (!userName) return NextResponse.json({ error: 'Nama user wajib diisi' }, { status: 400 })

      const previous = byName.get(userName.toLowerCase())
      let pinHash = previous?.pin_hash
      if (pin) {
        if (!/^\d{4,12}$/.test(pin)) {
          return NextResponse.json({ error: `PIN ${userName} harus 4-12 angka` }, { status: 400 })
        }
        pins.push(pin)
        pinHash = hashPin(pin)
      } else if (!pinHash && previous?.pin) {
        pinHash = hashPin(previous.pin)
      }
      if (!pinHash) {
        return NextResponse.json({ error: `PIN ${userName} wajib diisi` }, { status: 400 })
      }

      users.push({ name: userName, pin_hash: pinHash, role, aktif: row.aktif !== false, owner: false })
    }

    if (users.length === 0) return NextResponse.json({ error: 'Minimal satu user' }, { status: 400 })

    const names = users.map((user) => user.name.toLowerCase())
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
      user_name: session.name,
    })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
