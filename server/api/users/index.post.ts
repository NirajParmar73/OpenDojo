import { z } from 'zod'
import { db, tables } from '../../utils/database'
import { eq } from 'drizzle-orm'
import { getAllowedAssignmentsForCreator } from '../../utils/permissions'
import { assertStaffAccountLimit } from '../../utils/subscription'

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'member']).default('member'),
  danDegree: z.string().optional().nullable(),
  assignments: z.array(z.object({
    role: z.enum(['owner', 'admin', 'country_head', 'state_head', 'district_head', 'city_head', 'zone_head', 'dojo_head', 'instructor', 'member']),
    scopeType: z.enum(['node', 'dojo']),
    scopeId: z.number().int().positive(),
  })).optional(),
})

const nodeScopedRoles = new Set(['country_head', 'state_head', 'district_head', 'city_head', 'zone_head'])
const dojoScopedRoles = new Set(['dojo_head', 'instructor'])

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  // 1. Get the permissions of the creator (allowed roles and scopes)
  const { allowedRoles, allowedNodeIds, allowedDojoIds } = await getAllowedAssignmentsForCreator(
    session.user.id,
    orgId
  )

  // If the creator has no permissions to create users, deny
  if (allowedRoles.length === 0 && allowedNodeIds.length === 0 && allowedDojoIds.length === 0) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have permission to create users' })
  }

  // 2. Parse and validate the request body
  const body = await readValidatedBody(event, createUserSchema.parse)
  await assertStaffAccountLimit(orgId)

  if (body.role === 'admin' && session.user.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only an owner can create an admin user' })
  }

  // 3. Check if email already exists
  const existing = await db.query.users.findFirst({
    where: eq(tables.users.email, body.email),
  })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Email already registered' })
  }

  // 4. Validate each assignment
  if (body.assignments) {
    for (const assign of body.assignments) {
      // a. Check if role is allowed for this creator
      if (!allowedRoles.includes(assign.role)) {
        throw createError({
          statusCode: 403,
          statusMessage: `You cannot assign role: ${assign.role}`,
        })
      }

      if ((nodeScopedRoles.has(assign.role) && assign.scopeType !== 'node') || (dojoScopedRoles.has(assign.role) && assign.scopeType !== 'dojo')) {
        throw createError({ statusCode: 400, statusMessage: `Role ${assign.role} must use a ${nodeScopedRoles.has(assign.role) ? 'node' : 'dojo'} scope` })
      }

      // b. Check if scope is allowed for this creator
      let scopeAllowed = false
      if (assign.scopeType === 'node') {
        scopeAllowed = allowedNodeIds.includes(assign.scopeId)
      } else if (assign.scopeType === 'dojo') {
        scopeAllowed = allowedDojoIds.includes(assign.scopeId)
      }
      if (!scopeAllowed) {
        throw createError({
          statusCode: 403,
          statusMessage: `You do not have access to the selected ${assign.scopeType}`,
        })
      }

      // c. Verify that the scope actually exists and belongs to the organization
      if (assign.scopeType === 'node') {
        const node = await db.query.hierarchyNodes.findFirst({
          where: eq(tables.hierarchyNodes.id, assign.scopeId),
        })
        if (!node || node.organizationId !== orgId) {
          throw createError({ statusCode: 400, statusMessage: `Invalid node ID: ${assign.scopeId}` })
        }
      } else if (assign.scopeType === 'dojo') {
        const dojo = await db.query.dojos.findFirst({
          where: eq(tables.dojos.id, assign.scopeId),
        })
        if (!dojo || dojo.organizationId !== orgId) {
          throw createError({ statusCode: 400, statusMessage: `Invalid dojo ID: ${assign.scopeId}` })
        }
      }
    }
  }

  // 5. Hash password
  const hashed = await hashPassword(body.password)

  // 6. Create user (with default role 'member' if no assignments)
  const [user] = await db.insert(tables.users).values({
    name: body.name,
    email: body.email,
    passwordHash: hashed,
    role: body.role,
    organizationId: orgId,
    danDegree: body.danDegree || null,
  }).returning()

  if (!user) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create user' })
  }

  // 7. Insert assignments
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

  // 8. Fetch the created user with assignments (for the response)
  const createdUser = await db.query.users.findFirst({
    where: eq(tables.users.id, user.id),
    with: { assignments: true },
  })

  // Remove password hash from response
  const { passwordHash, ...userWithoutPassword } = createdUser!
  return { success: true, user: userWithoutPassword }
})
