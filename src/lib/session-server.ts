import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySession, type SessionUser } from './session'

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  return verifySession(store.get(SESSION_COOKIE)?.value)
}
