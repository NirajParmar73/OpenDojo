export function formatAmount(amount: number, currency: string = 'INR'): string {
  // PDFKit's built-in fonts cannot reliably render every currency glyph.
  if (currency === 'INR') return `INR ${(amount / 100).toFixed(2)}`
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount / 100)
}

export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100)
}

export function fromMinorUnits(amount: number): number {
  return amount / 100
}
