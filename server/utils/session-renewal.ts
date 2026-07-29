import type { H3Event } from 'h3'
import type { UserSession } from '#auth-utils'

const SESSION_RENEWAL_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

export async function renewUserSessionIfNeeded(event: H3Event, session: UserSession) {
  const renewedAt = new Date(session.sessionRefreshedAt || session.lastLoggedIn || 0).getTime()
  if (Number.isFinite(renewedAt) && Date.now() - renewedAt < SESSION_RENEWAL_INTERVAL_MS) return

  const { id: _sessionId, ...data } = session
  await replaceUserSession(event, {
    ...data,
    sessionRefreshedAt: new Date(),
  })
}
