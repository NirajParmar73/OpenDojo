import { z } from 'zod'
import { db, tables } from '../../../server/utils/database'
import { eq } from 'drizzle-orm'

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  danDegree: z.string().optional(),
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

  const body = await readValidatedBody(event, createUserSchema.parse)

  // Check if email already exists
  const existing = await db.query.users.findFirst({
    where: eq(tables.users.email, body.email),
  })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Email already registered' })
  }

  // Validate each assignment's scope belongs to the organization
  if (body.assignments) {
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
        throw createError({ statusCode: 400, statusMessage: `Invalid scope for assignment: ${assign.scopeType} ID ${assign.scopeId}` })
      }
    }
  }

  // Hash password
  const hashed = await hashPassword(body.password)

  // Create user and assignments in a transaction
  const [user] = await db.insert(tables.users).values({
    name: body.name,
    email: body.email,
    passwordHash: hashed,
    role: 'member', // default, but assignments will override
    organizationId: orgId,
    danDegree: body.danDegree || null,
  }).returning()

  if (!user) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create user' })
  }

  // Insert assignments
  if (body.assignments && body.assignments.length > 0) {
    const assignmentsData = body.assignments.map((assign) => ({
      userId: user.id,
      role: assign.role,
      scopeType: assign.scopeType,
      scopeId: assign.scopeId,
      startDate: null,
      endDate: null,
    }))
    await db.insert(tables.assignments).values(assignmentsData)
  }

  // Fetch the user with assignments
  const createdUser = await db.query.users.findFirst({
    where: eq(tables.users.id, user.id),
    with: { assignments: true },
  })

  const { passwordHash, ...userWithoutPassword } = createdUser!
  return { success: true, user: userWithoutPassword }
})