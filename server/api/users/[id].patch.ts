import { z } from 'zod'
import { db, tables } from '../../../server/utils/database'
import { eq, and } from 'drizzle-orm'
import { canEditManagedUser, getAllowedAssignmentsForCreator, getHierarchyManagementScope } from '../../utils/permissions'
import { writeAuditLog } from '../../utils/audit'
import { formatHierarchyNodeLabel } from '../../utils/hierarchy-label'

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  danDegree: z.string().optional().nullable(),
  role: z.enum(['admin', 'member']).optional(),
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
    with: { assignments: true },
  })
  if (!existingUser) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }
  if (existingUser.role === 'owner' && session.user.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Only an owner can manage an owner account' })
  if (body.role !== undefined && body.role !== existingUser.role && session.user.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only the organization owner can change an account access level' })
  }

  const allowed = await getAllowedAssignmentsForCreator(session.user.id, orgId)
  const managementScope = await getHierarchyManagementScope(session.user.id, orgId)
  if (session.user.role !== 'owner' && allowed.allowedRoles.length === 0) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have permission to manage users' })
  }
  if (!canEditManagedUser(session.user.id, session.user.role, existingUser, allowed)) throw createError({ statusCode: 403, statusMessage: 'This user is not a lower-level member entirely within your territory' })

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
    const unchangedAssignments = new Set(existingUser.assignments.map(assignment => `${assignment.role}:${assignment.scopeType}:${assignment.scopeId}`))
    console.log('📥 Received assignments:', JSON.stringify(body.assignments, null, 2))
    for (const assign of body.assignments) {
      const isUnchanged = unchangedAssignments.has(`${assign.role}:${assign.scopeType}:${assign.scopeId}`)
      if (!allowed.allowedRoles.includes(assign.role) && !isUnchanged) {
        throw createError({ statusCode: 403, statusMessage: `You cannot assign role: ${assign.role}` })
      }
      if ((nodeScopedRoles.has(assign.role) && assign.scopeType !== 'node') || (dojoScopedRoles.has(assign.role) && assign.scopeType !== 'dojo')) {
        throw createError({ statusCode: 400, statusMessage: `Role ${assign.role} must use a ${nodeScopedRoles.has(assign.role) ? 'node' : 'dojo'} scope` })
      }
      let valid = false
      if (assign.scopeType === 'node') {
        const node = await db.query.hierarchyNodes.findFirst({
          where: eq(tables.hierarchyNodes.id, assign.scopeId),
        })
        valid = !!node && node.organizationId === orgId && (allowed.allowedNodeIds.includes(assign.scopeId) || (isUnchanged && managementScope.managedParentNodeIds.includes(assign.scopeId)))
      } else if (assign.scopeType === 'dojo') {
        const dojo = await db.query.dojos.findFirst({
          where: eq(tables.dojos.id, assign.scopeId),
        })
        valid = !!dojo && dojo.organizationId === orgId && allowed.allowedDojoIds.includes(assign.scopeId)
      }
      if (!valid) {
        console.error(`❌ Invalid scope: ${assign.scopeType} ID ${assign.scopeId}`)
        throw createError({ statusCode: 403, statusMessage: `This ${assign.scopeType} is outside your permitted territory` })
      }
    }
  }

  // Update user details
  const updateData: any = {}
  if (body.name !== undefined) updateData.name = body.name
  if (body.email !== undefined) updateData.email = body.email
  if (body.danDegree !== undefined) updateData.danDegree = body.danDegree
  if (body.role !== undefined) updateData.role = body.role
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
        const level = node ? await db.query.hierarchyLevels.findFirst({ where: eq(tables.hierarchyLevels.id, node.levelId) }) : null
        scopeName = node ? formatHierarchyNodeLabel(node.name, level?.name) : null
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
  const auditAssignment = body.assignments?.length === 1 ? body.assignments[0] : null
  await writeAuditLog({
    organizationId: orgId,
    actorUserId: session.user.id,
    action: 'user.access_updated',
    entityType: 'user',
    entityId: Number(id),
    targetLabel: updatedUser!.name,
    scope: auditAssignment ? { type: auditAssignment.scopeType, id: auditAssignment.scopeId } : { type: 'organization' },
    details: body.assignments !== undefined ? `${body.assignments.length} scoped assignment${body.assignments.length === 1 ? '' : 's'} configured` : Object.keys(updateData).filter(key => key !== 'updatedAt').join(', '),
  })
  return {
    success: true,
    user: {
      ...userWithoutPassword,
      assignments: assignmentsWithScope,
    },
  }
})
