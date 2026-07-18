import { db, tables } from '../../utils/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const user = await db.query.users.findFirst({
    where: eq(tables.users.id, session.user.id),
    columns: {
      name: true,
      email: true,
      avatar: true,
      danDegree: true,
      createdAt: true,
      role: true,
      emailVerifiedAt: true,
    },
    with: { assignments: true },
  })
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const assignments = await Promise.all(user.assignments.map(async assignment => {
    if (assignment.scopeType === 'node') {
      const node = await db.query.hierarchyNodes.findFirst({ where: eq(tables.hierarchyNodes.id, assignment.scopeId) })
      return { role: assignment.role, scopeName: node?.name || 'Hierarchy scope' }
    }
    const dojo = await db.query.dojos.findFirst({ where: eq(tables.dojos.id, assignment.scopeId) })
    return { role: assignment.role, scopeName: dojo?.name || 'Dojo scope' }
  }))

  // Session role is the active authorization context; prefer it when it is
  // available so the profile reflects the permissions currently in effect.
  return { ...user, role: session.user.role || user.role, assignments }
})
