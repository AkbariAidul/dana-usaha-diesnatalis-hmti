import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { OWNER_NAME, type DashboardRole } from './auth'
import { supabaseAdmin } from './supabase'

export type DashboardUserRecord = {
  name: string
  pin?: string
  pin_hash?: string
  role: DashboardRole
  aktif: boolean
  owner?: boolean
}

const KEY = 'dashboard_users'

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(pin, salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPinHash(pin: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  try {
    const expected = Buffer.from(hash, 'hex')
    const actual = scryptSync(pin, salt, expected.length)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

function verifyPin(record: DashboardUserRecord, pin: string): boolean {
  if (record.pin_hash) return verifyPinHash(pin, record.pin_hash)
  if (!record.pin) return false
  const expected = Buffer.from(record.pin)
  const actual = Buffer.from(pin)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function defaultDashboardUsers(): DashboardUserRecord[] {
  const pin = process.env.DASHBOARD_PIN
  const pinNazwa = process.env.DASHBOARD_PIN_NAZWA
  const pinSyifa = process.env.DASHBOARD_PIN_SYIFA
  const pinViewer = process.env.DASHBOARD_PIN_VIEWER
  if (process.env.NODE_ENV === 'production' && (!pin || !pinNazwa || !pinSyifa || !pinViewer)) {
    console.warn('[security] DASHBOARD_PIN belum di-set di environment produksi; fitur login PIN dinonaktifkan')
    return []
  }
  return [
    { name: OWNER_NAME, pin: pin || undefined, role: 'pengelola', aktif: true, owner: true },
    { name: 'Nazwa Nur Rahma', pin: pinNazwa ? pinNazwa : undefined, role: 'pengelola', aktif: true },
    { name: 'Nor Syifa', pin: pinSyifa ? pinSyifa : undefined, role: 'pengelola', aktif: true },
    { name: pinViewer ? pinViewer : 'Pelihat', pin: pinViewer ? pinViewer : undefined, role: 'viewer', aktif: true },
  ]
}

function normalizeRole(value: unknown): DashboardRole {
  return value === 'viewer' ? 'viewer' : 'pengelola'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function loadDashboardUsers(): Promise<DashboardUserRecord[]> {
  const { data } = await supabaseAdmin.from('pengaturan_umum').select('value').eq('key', KEY).maybeSingle()
  if (!data?.value) return defaultDashboardUsers()
  try {
    const parsed = JSON.parse(data.value)
    if (!Array.isArray(parsed)) return defaultDashboardUsers()
    const records: DashboardUserRecord[] = parsed
      .filter(isRecord)
      .map((item) => ({
        name: String(item.name ?? '').trim(),
        pin: item.pin ? String(item.pin) : undefined,
        pin_hash: item.pin_hash ? String(item.pin_hash) : undefined,
        role: normalizeRole(item.role),
        aktif: item.aktif !== false,
        owner: item.owner === true || item.name === OWNER_NAME,
      }))
      .filter((item) => item.name && (item.pin || item.pin_hash))
    if (!records.some((item) => item.owner)) records.unshift(defaultDashboardUsers()[0])
    return records
  } catch {
    return defaultDashboardUsers()
  }
}

export async function saveDashboardUsers(users: DashboardUserRecord[]): Promise<void> {
  const stored = users.map(({ pin, pin_hash, ...rest }) => {
    if (pin) return { ...rest, pin_hash: pin.startsWith('scrypt$') ? pin : hashPin(pin) }
    if (pin_hash) return { ...rest, pin_hash }
    throw new Error(`PIN ${rest.name} kosong`)
  })
  const { error } = await supabaseAdmin
    .from('pengaturan_umum')
    .upsert({ key: KEY, value: JSON.stringify(stored), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
}

export async function findActiveUserByPIN(pin: string): Promise<DashboardUserRecord | null> {
  const users = await loadDashboardUsers()
  return users.find((user) => user.aktif && verifyPin(user, pin)) ?? null
}
