import { OWNER_NAME, type DashboardRole } from './auth'
import { supabaseAdmin } from './supabase'

export type DashboardUserRecord = {
  name: string
  pin: string
  role: DashboardRole
  aktif: boolean
  owner?: boolean
}

const KEY = 'dashboard_users'

export function defaultDashboardUsers(): DashboardUserRecord[] {
  return [
    { name: OWNER_NAME, pin: process.env.DASHBOARD_PIN || '079876', role: 'pengelola', aktif: true, owner: true },
    { name: 'Nazwa Nur Rahma', pin: process.env.DASHBOARD_PIN_NAZWA || '112233', role: 'pengelola', aktif: true },
    { name: 'Nor Syifa', pin: process.env.DASHBOARD_PIN_SYIFA || '445566', role: 'pengelola', aktif: true },
    { name: process.env.DASHBOARD_VIEWER_NAME || 'Pelihat', pin: process.env.DASHBOARD_PIN_VIEWER || '778899', role: 'viewer', aktif: true },
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
        pin: String(item.pin ?? ''),
        role: normalizeRole(item.role),
        aktif: item.aktif !== false,
        owner: item.owner === true || item.name === OWNER_NAME,
      }))
      .filter((item) => item.name && item.pin)
    if (!records.some((item) => item.owner)) records.unshift(defaultDashboardUsers()[0])
    return records
  } catch {
    return defaultDashboardUsers()
  }
}

export async function saveDashboardUsers(users: DashboardUserRecord[]): Promise<void> {
  const { error } = await supabaseAdmin
    .from('pengaturan_umum')
    .upsert({ key: KEY, value: JSON.stringify(users), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
}

export async function findActiveUserByPIN(pin: string): Promise<DashboardUserRecord | null> {
  const users = await loadDashboardUsers()
  return users.find((user) => user.pin === pin && user.aktif) ?? null
}
