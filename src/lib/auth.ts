export type DashboardRole = 'tenant' | 'merchandise' | 'ticket'

export type DashboardUser = {
  name: string
  role: DashboardRole
}

const USERS: Array<{ pin: string; user: DashboardUser }> = [
  { pin: process.env.DASHBOARD_PIN || '079876', user: { name: 'Aidul Akbari', role: 'tenant' } },
  { pin: process.env.DASHBOARD_PIN_NAZWA || '112233', user: { name: 'Nazwa Nur Rahma', role: 'merchandise' } },
  { pin: process.env.DASHBOARD_PIN_SYIFA || '445566', user: { name: 'Nor Syifa', role: 'ticket' } },
]

export function findUserByPIN(inputPin: string): DashboardUser | null {
  return USERS.find((entry) => entry.pin === inputPin)?.user ?? null
}
