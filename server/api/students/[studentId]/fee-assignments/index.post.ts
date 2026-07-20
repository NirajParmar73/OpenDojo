import { z } from 'zod'
import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { isDojoAccessible, isDojoWithinHierarchyNode } from '../../../../utils/permissions'

const createAssignmentSchema = z.object({
  feePlanId: z.number().int().positive(),
  startDate: z.string(),
  endDate: z.string().optional().nullable(),
  dueDay: z.number().int().min(1).max(28).default(1),
  discount: z.number().int().min(0).default(0),
  discountReason: z.string().trim().max(500).optional(),
}).refine(body => body.discount === 0 || !!body.discountReason, { message: 'A discount reason is required', path: ['discountReason'] })

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const studentId = getRouterParam(event, 'studentId')
  if (!studentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing student ID' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  // Verify student
  const student = await db.query.students.findFirst({
    where: and(
      eq(tables.students.id, Number(studentId)),
      eq(tables.students.organizationId, orgId)
    ),
  })
  if (!student) {
    throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  }
  if (student.dojoId ? !await isDojoAccessible(session.user.id, orgId, student.dojoId) : session.user.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }

  const body = await readValidatedBody(event, createAssignmentSchema.parse)

  // Verify fee plan
  const feePlan = await db.query.feePlans.findFirst({
    where: and(
      eq(tables.feePlans.id, body.feePlanId),
      eq(tables.feePlans.organizationId, orgId)
    ),
  })
  if (!feePlan) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid fee plan' })
  }
  if (feePlan.dojoId && feePlan.dojoId !== student.dojoId) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a fee plan for this student\'s dojo.' })
  }
  if (feePlan.scopeNodeId && (!student.dojoId || !await isDojoWithinHierarchyNode(orgId, student.dojoId, feePlan.scopeNodeId))) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a fee plan for this student\'s territory.' })
  }
  if (feePlan.frequency !== 'one-time') {
    const activeAssignments = await db.query.studentFeeAssignments.findMany({
      where: and(
        eq(tables.studentFeeAssignments.studentId, Number(studentId)),
        eq(tables.studentFeeAssignments.status, 'active')
      ),
      with: { feePlan: true },
    }) as any[]
    if (activeAssignments.some(assignment => assignment.feePlan.frequency !== 'one-time')) {
      throw createError({ statusCode: 409, statusMessage: 'End the student\'s current recurring fee plan before assigning another one.' })
    }
  }

  const [assignment] = await db.insert(tables.studentFeeAssignments).values({
    studentId: Number(studentId),
    feePlanId: body.feePlanId,
    startDate: new Date(body.startDate),
    endDate: body.endDate ? new Date(body.endDate) : null,
    dueDay: body.dueDay,
    discount: body.discount,
    discountReason: body.discount ? body.discountReason : null,
    status: 'active',
  }).returning() as any[]

  if (!assignment) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to assign fee plan' })
  }

  return { success: true, assignment }
})
