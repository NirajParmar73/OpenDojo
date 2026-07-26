export type CurrencyCode = string

export type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'other'
export type AdditionalFeeType = 'grading_exam' | 'miscellaneous'

export interface PaymentFeeItem {
  type: AdditionalFeeType
  label: string
  amount: number
}

export interface PaymentBreakdown {
  tuitionAmount: number
  feeItems: PaymentFeeItem[]
  totalAmount: number
}
