import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'
export default defineEventHandler(async event => { const session = await getUserSession(event); const id = Number(getRouterParam(event, 'id')); if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' }); return db.query.studentAchievements.findMany({ where: and(eq(tables.studentAchievements.tournamentId, id), eq(tables.studentAchievements.organizationId, session.user.organizationId)), with: { student: true } }) })
