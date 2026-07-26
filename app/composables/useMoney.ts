import type { CurrencyCode } from '../../shared/types/finance'
import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

export function useMoney(currency: MaybeRefOrGetter<CurrencyCode | null | undefined>) {
  const currencyCode = computed(() => toValue(currency) || 'INR')

  function formatMinor(amount?: number | null) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode.value,
    }).format((amount || 0) / 100)
  }

  function toMinor(amount?: number | null) {
    if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) return 0
    return Math.round(Number(amount) * 100)
  }

  function fromMinor(amount?: number | null) {
    return (amount || 0) / 100
  }

  return { currencyCode, formatMinor, toMinor, fromMinor }
}
