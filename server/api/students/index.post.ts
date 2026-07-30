import { createStudentSchema, enrollStudent } from '../../services/student-enrollment'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (!session.user.organizationId) throw createError({ statusCode: 400, statusMessage: 'User has no organization' })

  const body = await readValidatedBody(event, createStudentSchema.parse)
  const result = await enrollStudent(session.user.id, session.user.organizationId, body)
  return { success: true, ...result }
})
