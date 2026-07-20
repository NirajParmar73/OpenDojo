import { createHmac, timingSafeEqual } from 'node:crypto'

export const razorpayPlans = ['city-starter', 'city-pro', 'state-pro', 'national'] as const
export type RazorpayPlan = typeof razorpayPlans[number]
export type RazorpayBillingPeriod = 'monthly' | 'annual'

const prices: Record<RazorpayPlan, Record<RazorpayBillingPeriod, number>> = {
  'city-starter': { monthly: 19900, annual: 199000 },
  'city-pro': { monthly: 39900, annual: 399000 },
  'state-pro': { monthly: 69900, annual: 699000 },
  national: { monthly: 199900, annual: 1999000 },
}

type RazorpayOrder = { id: string, amount: number, currency: string, status: string, notes?: Record<string, string> }

function config() {
  const runtimeConfig = useRuntimeConfig()
  if (!runtimeConfig.razorpayKeyId || !runtimeConfig.razorpayKeySecret) throw createError({ statusCode: 503, statusMessage: 'Razorpay billing is not configured yet.' })
  return runtimeConfig
}

async function razorpayRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const runtimeConfig = config()
  const authorization = Buffer.from(`${runtimeConfig.razorpayKeyId}:${runtimeConfig.razorpayKeySecret}`).toString('base64')
  const response = await fetch(`https://api.razorpay.com/v1${path}`, { ...init, headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw createError({ statusCode: 502, statusMessage: payload?.error?.description || 'Razorpay could not create the payment order.' })
  return payload as T
}

export function getRazorpayPrice(plan: RazorpayPlan, billingPeriod: RazorpayBillingPeriod) { return prices[plan][billingPeriod] }

export async function createRazorpayOrder(plan: RazorpayPlan, billingPeriod: RazorpayBillingPeriod, organizationId: number, organizationName: string) {
  return razorpayRequest<RazorpayOrder>('/orders', { method: 'POST', body: JSON.stringify({ amount: getRazorpayPrice(plan, billingPeriod), currency: 'INR', receipt: `opendojo_${organizationId}_${Date.now()}`, notes: { organization_id: String(organizationId), organization_name: organizationName.slice(0, 50), plan, billing_period: billingPeriod } }) })
}

export function verifyRazorpayPaymentSignature(orderId: string, paymentId: string, signature: string) {
  const { razorpayKeySecret } = config()
  return safeEqual(createHmac('sha256', razorpayKeySecret).update(`${orderId}|${paymentId}`).digest('hex'), signature)
}

function safeEqual(left: string, right: string) { const leftBuffer = Buffer.from(left); const rightBuffer = Buffer.from(right); return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer) }
