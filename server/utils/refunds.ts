export type CompletedRefund = {
  amount: number
  tuitionAmount?: number | null
  status?: string | null
}

export type RefundablePayment = {
  amount: number
  tuitionAmount?: number | null
  refunds?: CompletedRefund[]
}

function completed(refunds: CompletedRefund[] = []) {
  return refunds.filter(refund => !refund.status || refund.status === 'completed')
}

export function refundedAmount(payment: RefundablePayment) {
  return completed(payment.refunds).reduce((sum, refund) => sum + refund.amount, 0)
}

export function refundedTuitionAmount(payment: RefundablePayment) {
  return completed(payment.refunds).reduce((sum, refund) => sum + (refund.tuitionAmount || 0), 0)
}

export function netPaymentAmount(payment: RefundablePayment) {
  return payment.amount - refundedAmount(payment)
}

export function netTuitionAmount(payment: RefundablePayment) {
  return (payment.tuitionAmount ?? payment.amount) - refundedTuitionAmount(payment)
}
