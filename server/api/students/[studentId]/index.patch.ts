import { z } from 'zod'
import { db, tables } from '../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { isDojoAccessible } from '../../../utils/permissions'
import { writeAuditLog } from '../../../utils/audit'

const updateStudentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dojoId: z.number().int().positive().nullable().optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  joinedAt: z.string().date().optional(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  address: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  emergencyPhone: z.string().optional().nullable(),
  medicalNotes: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  // ✅ new fields
  currentBeltRankId: z.number().int().positive().nullable().optional(),
  avatar: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const id = getRouterParam(event, 'studentId')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  const body = await readValidatedBody(event, updateStudentSchema.parse)

  // Check student exists
  const existing = await db.query.students.findFirst({
    where: and(
      eq(tables.students.id, Number(id)),
      eq(tables.students.organizationId, orgId)
    ),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  }

  if (existing.dojoId && !await isDojoAccessible(session.user.id, orgId, existing.dojoId)) {
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }
  if (!existing.dojoId && session.user.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }

  // If dojoId provided, verify it belongs to organization
  if (body.dojoId !== undefined && body.dojoId !== null) {
    const dojo = await db.query.dojos.findFirst({
      where: eq(tables.dojos.id, body.dojoId),
    })
    if (!dojo || dojo.organizationId !== orgId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid dojo' })
    }
  }

  if (body.dojoId !== undefined && body.dojoId !== null
    && !await isDojoAccessible(session.user.id, orgId, body.dojoId)) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have access to the selected dojo' })
  }

  // If belt rank provided, verify it belongs to the organization's belt system
  if (body.currentBeltRankId !== undefined && body.currentBeltRankId !== null) {
    const rank = await db.query.beltRanks.findFirst({
      where: eq(tables.beltRanks.id, body.currentBeltRankId),
      with: { system: true },
    }) as any
    if (!rank || rank.system.organizationId !== orgId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid belt rank' })
    }
  }

  const updateData: any = {}
  if (body.firstName !== undefined) updateData.firstName = body.firstName
  if (body.lastName !== undefined) updateData.lastName = body.lastName
  if (body.email !== undefined) updateData.email = body.email
  if (body.phone !== undefined) updateData.phone = body.phone
  if (body.gender !== undefined) updateData.gender = body.gender
  if (body.address !== undefined) updateData.address = body.address
  if (body.emergencyContact !== undefined) updateData.emergencyContact = body.emergencyContact
  if (body.emergencyPhone !== undefined) updateData.emergencyPhone = body.emergencyPhone
  if (body.medicalNotes !== undefined) updateData.medicalNotes = body.medicalNotes
  if (body.status !== undefined) updateData.status = body.status
  if (body.dojoId !== undefined) updateData.dojoId = body.dojoId
  if (body.dateOfBirth !== undefined) {
    updateData.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null
  }
  if (body.joinedAt !== undefined) {
    updateData.joinedAt = new Date(`${body.joinedAt}T00:00:00.000Z`)
  }
  // ✅ new fields
  if (body.currentBeltRankId !== undefined) updateData.currentBeltRankId = body.currentBeltRankId
  if (body.avatar !== undefined) updateData.avatar = body.avatar

  updateData.updatedAt = new Date()

  const [updated] = await db.update(tables.students)
    .set(updateData)
    .where(eq(tables.students.id, Number(id)))
    .returning() as any[]

  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update student' })
  }
  await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: 'student.updated', entityType: 'student', entityId: updated.id, targetLabel: `${updated.firstName} ${updated.lastName}`, scope: updated.dojoId ? { type: 'dojo', id: updated.dojoId } : { type: 'organization' }, details: Object.keys(updateData).filter(key => key !== 'updatedAt').join(', ') })

  // Fetch full student with relations
  const fullStudent = await db.query.students.findFirst({
    where: eq(tables.students.id, Number(id)),
    with: { dojo: true, currentBeltRank: true },
  })

  return { success: true, student: fullStudent }
})
