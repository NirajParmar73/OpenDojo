import { z } from 'zod'
import { db, tables } from '../../../server/utils/database'
import { eq, and } from 'drizzle-orm'

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  danDegree: z.string().optional().nullable(),
  assignments: z.array(z.object({
    role: z.enum(['owner', 'admin', 'state_head', 'district_head', 'city_head', 'dojo_head', 'instructor', 'member']),
    scopeType: z.enum(['node', 'dojo']),
    scopeId: z.number().int().positive(),
  })).optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (!['owner', 'admin'].includes(session.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  const body = await readValidatedBody(event, updateUserSchema.parse)

  // Check if user exists
  const existingUser = await db.query.users.findFirst({
    where: and(
      eq(tables.users.id, Number(id)),
      eq(tables.users.organizationId, orgId)
    ),
  })
  if (!existingUser) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  // If email is updated, check uniqueness
  if (body.email && body.email !== existingUser.email) {
    const duplicate = await db.query.users.findFirst({
      where: eq(tables.users.email, body.email),
    })
    if (duplicate) {
      throw createError({ statusCode: 409, statusMessage: 'Email already in use' })
    }
  }

  // Validate assignments' scopes
  if (body.assignments) {
    console.log('📥 Received assignments:', JSON.stringify(body.assignments, null, 2))
    for (const assign of body.assignments) {
      let valid = false
      if (assign.scopeType === 'node') {
        const node = await db.query.hierarchyNodes.findFirst({
          where: eq(tables.hierarchyNodes.id, assign.scopeId),
        })
        valid = !!node && node.organizationId === orgId
      } else if (assign.scopeType === 'dojo') {
        const dojo = await db.query.dojos.findFirst({
          where: eq(tables.dojos.id, assign.scopeId),
        })
        valid = !!dojo && dojo.organizationId === orgId
      }
      if (!valid) {
        console.error(`❌ Invalid scope: ${assign.scopeType} ID ${assign.scopeId}`)
        throw createError({ statusCode: 400, statusMessage: `Invalid scope for assignment: ${assign.scopeType} ID ${assign.scopeId}` })
      }
    }
  }

  // Update user details
  const updateData: any = {}
  if (body.name !== undefined) updateData.name = body.name
  if (body.email !== undefined) updateData.email = body.email
  if (body.danDegree !== undefined) updateData.danDegree = body.danDegree
  updateData.updatedAt = new Date()

  await db.update(tables.users)
    .set(updateData)
    .where(eq(tables.users.id, Number(id)))

  // ---------- Handle assignments ----------
  if (body.assignments !== undefined) {
    console.log(`🔄 Deleting existing assignments for user ${id}`)
    await db.delete(tables.assignments)
      .where(eq(tables.assignments.userId, Number(id)))

    if (body.assignments.length > 0) {
      console.log(`➕ Inserting ${body.assignments.length} new assignments`)
      const assignmentsData = body.assignments.map((assign) => ({
        userId: Number(id),
        role: assign.role,
        scopeType: assign.scopeType,
        scopeId: assign.scopeId,
        startDate: null,
        endDate: null,
      }))
      try {
        await db.insert(tables.assignments).values(assignmentsData)
        console.log('✅ Assignments inserted successfully')
      } catch (error) {
        console.error('❌ Failed to insert assignments:', error)
        throw createError({ statusCode: 500, statusMessage: 'Failed to update assignments' })
      }
    } else {
      console.log('ℹ️ No assignments to insert')
    }
  }

  // Fetch updated user
  const updatedUser = await db.query.users.findFirst({
    where: eq(tables.users.id, Number(id)),
    with: { assignments: true },
  })

  // Add scope names
  const assignmentsWithScope = await Promise.all(
    (updatedUser?.assignments || []).map(async (assignment) => {
      let scopeName = null
      if (assignment.scopeType === 'node') {
        const node = await db.query.hierarchyNodes.findFirst({
          where: eq(tables.hierarchyNodes.id, assignment.scopeId),
        })
        scopeName = node?.name || null
      } else if (assignment.scopeType === 'dojo') {
        const dojo = await db.query.dojos.findFirst({
          where: eq(tables.dojos.id, assignment.scopeId),
        })
        scopeName = dojo?.name || null
      }
      return { ...assignment, scopeName }
    })
  )

  const { passwordHash, ...userWithoutPassword } = updatedUser!
  return {
    success: true,
    user: {
      ...userWithoutPassword,
      assignments: assignmentsWithScope,
    },
  }
})