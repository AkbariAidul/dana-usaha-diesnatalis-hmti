export type DashboardRole = 'tenant' | 'merchandise' | 'ticket' | 'viewer' | 'pengelola'

export const OWNER_NAME = 'Aidul Akbari'

export type DashboardUser = {
  name: string
  role: DashboardRole
}

const USERS: Array<{ pin: string; user: DashboardUser }> = [
  { pin: process.env.DASHBOARD_PIN ?? '079876', user: { name: 'Aidul Akbari', role: 'tenant' } },
  { pin: process.env.DASHBOARD_PIN_NAZWA ?? '112233', user: { name: 'Nazwa Nur Rahma', role: 'merchandise' } },
  { pin: process.env.DASHBOARD_PIN_SYIFA ?? '445566', user: { name: 'Nor Syifa', role: 'ticket' } },
  { pin: process.env.DASHBOARD_PIN_VIEWER ?? '778899', user: { name: process.env.DASHBOARD_VIEWER_NAME ?? 'Pelihat', role: 'viewer' } },
]

export function findUserByPIN(inputPin: string): DashboardUser | null {
  return USERS.find((entry) => entry.pin === inputPin)?.user ?? null
}

export function findPINByUser(name: string): string | null {
  return USERS.find((entry) => entry.user.name === name)?.pin ?? null
}

export function listDashboardUsers(): DashboardUser[] {
  return USERS.map((entry) => entry.user)
}

export function normalizeDashboardUserName(value: string): string {
  const byPin = findUserByPIN(value.trim())
  if (byPin) return byPin.name
  const query = value.trim().toLowerCase()
  const match = USERS.find(({ user }) => {
    const name = user.name.toLowerCase()
    return name === query || name.split(' ')[0] === query
  })
  return match?.user.name ?? value
}
