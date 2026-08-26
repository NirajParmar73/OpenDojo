import nodemailer from 'nodemailer'
import { z } from 'zod/v4'

const schema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(255),
  organization: z.string().trim().max(255).optional().default(''),
  accountType: z.enum(['organization_owner', 'staff', 'student']),
  details: z.string().trim().max(1000).optional().default(''),
  website: z.string().max(0).optional().default('')
})

export default defineEventHandler(async event => {
  const body = await readValidatedBody(event, schema.parse)
  if (body.website) return { success: true }
  const recipient = String(useRuntimeConfig(event).public.supportEmail || '').trim()
  if (!recipient || !process.env.SMTP_HOST || !process.env.EMAIL_FROM) {
    throw createError({ statusCode: 503, statusMessage: `Deletion requests are temporarily unavailable. Email ${recipient || 'support'} directly.` })
  }
  const session = await getUserSession(event)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined
  })
  const accountLabel = ({ organization_owner: 'Organization owner', staff: 'Staff', student: 'Student portal' } as const)[body.accountType]
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: recipient,
    replyTo: body.email,
    subject: `[Account deletion] ${accountLabel} - ${body.email}`,
    text: [
      'An OpenDojos account deletion request was submitted.',
      '',
      `Name: ${body.name}`,
      `Email: ${body.email}`,
      `Account type: ${accountLabel}`,
      `Organization / dojo: ${body.organization || 'Not supplied'}`,
      `Signed-in account ID: ${session?.user?.id || 'Not signed in'}`,
      `Signed-in organization ID: ${session?.user?.organizationId || 'Not signed in'}`,
      `Request ID: ${event.context.requestId || 'Unavailable'}`,
      '',
      `Details: ${body.details || 'None supplied'}`,
      '',
      'Verify identity and ownership before deleting any data.'
    ].join('\n')
  })
  return { success: true }
})
