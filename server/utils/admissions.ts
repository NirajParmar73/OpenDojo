import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { db, tables } from './database'
import { currentTenant, organizationSlug } from './tenant'

export const defaultAdmissionForm = {
  title: 'Student admission application',
  introduction: 'Complete this form to apply for admission.',
  physicalCopyInstructions: 'Download, print, sign, and submit this form to the organization.',
  privacyNotice: 'Your information will be used to process this admission application.',
  consentText: 'I confirm that the information provided is accurate and consent to its use for admission processing.',
  isPublished: false,
  requirePhysicalCopy: true,
}

export function admissionTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function resolveAdmissionOrganization(event: H3Event) {
  const tenant = currentTenant(event)
  if (tenant) return db.query.organizations.findFirst({ where: eq(tables.organizations.id, tenant.id) })

  // This fallback makes local development possible without wildcard DNS. In
  // production, the hostname remains the source of tenant identity.
  const requestedSlug = organizationSlug(String(getQuery(event).organization || ''))
  if (!requestedSlug) return null
  return db.query.organizations.findFirst({ where: eq(tables.organizations.slug, requestedSlug) })
}

export async function getAdmissionForm(organizationId: number) {
  return await db.query.admissionForms.findFirst({ where: eq(tables.admissionForms.organizationId, organizationId) })
    || { ...defaultAdmissionForm, organizationId }
}

