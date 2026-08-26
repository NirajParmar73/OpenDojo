import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, tables } from '../../utils/database'
import { writeAuditLog } from '../../utils/audit'

const schema = z.object({
  title: z.string().trim().min(3).max(150),
  introduction: z.string().trim().min(3).max(2000),
  physicalCopyInstructions: z.string().trim().min(3).max(2000),
  privacyNotice: z.string().trim().min(3).max(4000),
  consentText: z.string().trim().min(3).max(4000),
  isPublished: z.boolean(),
  requirePhysicalCopy: z.boolean(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId || !['owner', 'admin'].includes(session.user.role)) throw createError({ statusCode: 403, statusMessage: 'Organization administrator access required' })
  const body = await readValidatedBody(event, schema.parse)
  const existing = await db.query.admissionForms.findFirst({ where: eq(tables.admissionForms.organizationId, session.user.organizationId) })
  const values = { ...body, updatedBy: session.user.id, updatedAt: new Date() }
  const [form] = existing
    ? await db.update(tables.admissionForms).set(values).where(eq(tables.admissionForms.id, existing.id)).returning()
    : await db.insert(tables.admissionForms).values({ organizationId: session.user.organizationId, ...values }).returning()
  await writeAuditLog({ organizationId: session.user.organizationId, actorUserId: session.user.id, action: body.isPublished ? 'admission_form.published' : 'admission_form.updated', entityType: 'admission_form', entityId: form!.id, targetLabel: body.title, scope: { type: 'organization' } })
  return form
})

