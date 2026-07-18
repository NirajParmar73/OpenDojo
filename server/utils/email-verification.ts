import crypto from 'node:crypto'
import nodemailer from 'nodemailer'
import { eq } from 'drizzle-orm'
import { db, tables } from './database'

const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex')
const configured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.EMAIL_FROM)

export async function sendVerificationEmail(event: any, user: { id: number, email: string, name: string }) {
  if (!configured()) throw createError({ statusCode: 503, statusMessage: 'Email delivery is not configured' })
  const existing = await db.query.emailVerificationTokens.findFirst({ where: eq(tables.emailVerificationTokens.userId, user.id) })
  if (existing && Date.now() - existing.sentAt.getTime() < 60_000) throw createError({ statusCode: 429, statusMessage: 'Please wait a minute before requesting another email' })
  const token = crypto.randomBytes(32).toString('hex')
  await db.delete(tables.emailVerificationTokens).where(eq(tables.emailVerificationTokens.userId, user.id))
  await db.insert(tables.emailVerificationTokens).values({ userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) })
  const configuredAppUrl = String(useRuntimeConfig(event).appUrl || '').replace(/\/$/, '')
  const origin = configuredAppUrl || getRequestURL(event).origin
  const url = `${origin}/auth/verify-email?token=${token}`
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } })
  await transporter.sendMail({ from: process.env.EMAIL_FROM, to: user.email, subject: 'Verify your OpenDojo email address', text: `Hello ${user.name}, verify your email address: ${url}\nThis link expires in 24 hours.`, html: `<p>Hello ${user.name},</p><p><a href="${url}">Verify your email address</a></p><p>This link expires in 24 hours.</p>` })
}

export const verificationHash = hash

export async function assertVerifiedEmail(userId: number) {
  const user = await db.query.users.findFirst({ where: eq(tables.users.id, userId), columns: { emailVerifiedAt: true } })
  if (!user?.emailVerifiedAt) throw createError({ statusCode: 403, statusMessage: 'Verify your email address before inviting staff or granting access.' })
}
