// utils/currency.ts
export function formatAmount(amount: number, currency: string = 'INR'): string {
  const symbols: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
  }
  const symbol = symbols[currency] || currency
  // amount is in minor units, divide by 100
  return `${symbol}${(amount / 100).toFixed(2)}`
}

export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100)
}

export function fromMinorUnits(amount: number): number {
  return amount / 100
}