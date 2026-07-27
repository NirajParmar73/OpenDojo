<template>
  <div class="mx-auto max-w-6xl">
    <section class="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="text-sm font-semibold text-primary">FINANCE</p>
        <h2 class="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Payment receipts</h2>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Payments and linked refunds in the dojos you can access.</p>
      </div>
      <div class="flex gap-2">
        <UButton to="/finance" color="neutral" variant="soft" icon="i-lucide-chart-no-axes-combined">Collections overview</UButton>
        <UButton to="/fees" color="primary" icon="i-lucide-circle-dollar-sign">Record payment</UButton>
      </div>
    </section>

    <UCard>
      <div v-if="pending" class="space-y-3"><USkeleton v-for="item in 6" :key="item" class="h-14" /></div>
      <UAlert v-else-if="error" color="error" title="Could not load recent receipts" description="Please try again." />
      <div v-else-if="receipts?.length" class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
            <tr><th class="px-3 py-3">Receipt</th><th class="px-3 py-3">Student</th><th class="px-3 py-3">Fee plan</th><th class="px-3 py-3">Date</th><th class="px-3 py-3">Amount</th><th class="px-3 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            <template v-for="receipt in receipts" :key="receipt.id">
              <tr class="border-b border-slate-100 dark:border-slate-800">
                <td class="px-3 py-4 font-medium">{{ receipt.receiptNumber }}<UBadge v-if="receipt.refundedAmount" color="error" variant="subtle" size="xs" class="ml-2">{{ receipt.refundableAmount ? 'Partially refunded' : 'Refunded' }}</UBadge></td>
                <td class="px-3 py-4"><NuxtLink :to="`/students/${receipt.student.id}`" class="font-medium hover:text-primary">{{ receipt.student.name }}</NuxtLink><p class="mt-1 text-xs text-slate-400">{{ receipt.student.dojoName }}</p></td>
                <td class="px-3 py-4 text-slate-600 dark:text-slate-300">{{ receipt.feePlanName }}</td>
                <td class="px-3 py-4 text-slate-600 dark:text-slate-300">{{ formatDate(receipt.paymentDate) }}</td>
                <td class="px-3 py-4"><p class="font-medium">{{ formatCurrency(receipt.amount) }}</p><p v-if="receipt.refundedAmount" class="mt-1 text-xs text-red-600">Refunded {{ formatCurrency(receipt.refundedAmount) }} · Net {{ formatCurrency(receipt.refundableAmount) }}</p></td>
                <td class="px-3 py-4"><div class="flex justify-end gap-1"><UButton :href="`/api/payments/${receipt.id}/receipt`" external size="xs" color="primary" variant="soft" icon="i-lucide-download">PDF</UButton><UButton v-if="canRefund && receipt.refundableAmount > 0" size="xs" color="error" variant="soft" icon="i-lucide-undo-2" @click="toggleRefund(receipt)">Refund</UButton></div></td>
              </tr>
              <tr v-if="receipt.refunds.length || refundingPaymentId === receipt.id" class="border-b border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40">
                <td colspan="6" class="px-5 py-4">
                  <div v-if="receipt.refunds.length" class="mb-4 space-y-2">
                    <div v-for="refund in receipt.refunds" :key="refund.id" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-white p-3 text-sm dark:border-red-950 dark:bg-slate-900">
                      <div><p class="font-medium text-red-700 dark:text-red-300">{{ refund.refundNumber }} · {{ formatCurrency(refund.amount) }}</p><p class="mt-1 text-xs text-slate-500">{{ formatDate(refund.refundedAt) }} · {{ refund.reason }}</p></div>
                      <UButton :href="`/api/refunds/${refund.id}/receipt`" external size="xs" color="error" variant="soft" icon="i-lucide-download">Refund PDF</UButton>
                    </div>
                  </div>
                  <form v-if="refundingPaymentId === receipt.id" class="rounded-xl border border-red-200 bg-white p-4 dark:border-red-900 dark:bg-slate-900" @submit.prevent="recordRefund(receipt)">
                    <div class="mb-4"><h3 class="font-semibold">Refund {{ receipt.receiptNumber }}</h3><p class="mt-1 text-sm text-slate-500">Maximum refundable: {{ formatCurrency(receipt.refundableAmount) }}. The original receipt will be preserved.</p></div>
                    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <UFormField label="Total refund" required><UInput v-model.number="refundForm.amount" type="number" min="0.01" :max="receipt.refundableAmount / 100" step="0.01" required /></UFormField>
                      <UFormField label="Tuition portion returned" help="This amount is added back to the student's outstanding tuition balance." required><UInput v-model.number="refundForm.tuitionAmount" type="number" min="0" :max="Math.min(refundForm.amount || 0, receipt.refundableTuitionAmount / 100)" step="0.01" required /></UFormField>
                      <UFormField label="Refund date" required><UInput v-model="refundForm.refundedAt" type="date" :min="receipt.paymentDate.slice(0, 10)" :max="today" required /></UFormField>
                      <UFormField label="Refund method" required><USelect v-model="refundForm.method" :items="refundMethods" required /></UFormField>
                      <UFormField label="Reference"><UInput v-model="refundForm.referenceNumber" placeholder="Bank, card, or cash reference" /></UFormField>
                      <UFormField label="Reason" required><UInput v-model="refundForm.reason" placeholder="Why is this payment being refunded?" maxlength="500" required /></UFormField>
                    </div>
                    <div class="mt-4 flex justify-end gap-2"><UButton type="button" color="neutral" variant="ghost" @click="cancelRefund">Cancel</UButton><UButton type="submit" color="error" icon="i-lucide-undo-2" :loading="submittingRefund">Record refund</UButton></div>
                  </form>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <div v-else class="py-12 text-center"><UIcon name="i-lucide-receipt-text" class="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" /><p class="mt-3 text-sm text-slate-500 dark:text-slate-400">No receipts have been created yet.</p></div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

type Refund = { id: number, amount: number, tuitionAmount: number, refundNumber: string, refundedAt: string, method: string, referenceNumber: string | null, reason: string }
type Receipt = { id: number, receiptNumber: string, amount: number, tuitionAmount: number, refundedAmount: number, refundedTuitionAmount: number, refundableAmount: number, refundableTuitionAmount: number, paymentDate: string, feePlanName: string, refunds: Refund[], student: { id: number, name: string, dojoName: string } }
const { user } = useUserSession()
const { data: receipts, pending, error, refresh } = await useFetch<Receipt[]>('/api/payments/recent')
const { data: organization } = await useFetch<{ currency?: string }>('/api/organization/settings')
const toast = useToast()
const today = new Date().toISOString().slice(0, 10)
const canRefund = computed(() => ['owner', 'admin'].includes(user.value?.role || ''))
const refundingPaymentId = ref<number | null>(null)
const submittingRefund = ref(false)
const refundMethods = [
  { label: 'Cash', value: 'cash' },
  { label: 'Bank transfer', value: 'bank_transfer' },
  { label: 'Card', value: 'card' },
  { label: 'Other', value: 'other' },
]
const refundForm = reactive({ amount: undefined as number | undefined, tuitionAmount: undefined as number | undefined, refundedAt: today, method: 'cash', referenceNumber: '', reason: '' })

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: organization.value?.currency || 'INR' }).format(amount / 100)
}

function toggleRefund(receipt: Receipt) {
  if (refundingPaymentId.value === receipt.id) {
    refundingPaymentId.value = null
    return
  }
  refundingPaymentId.value = receipt.id
  refundForm.amount = receipt.refundableAmount / 100
  refundForm.tuitionAmount = Math.min(receipt.refundableAmount, receipt.refundableTuitionAmount) / 100
  refundForm.refundedAt = today
  refundForm.method = 'cash'
  refundForm.referenceNumber = ''
  refundForm.reason = ''
}

function cancelRefund() {
  refundingPaymentId.value = null
}

async function recordRefund(receipt: Receipt) {
  const amount = Math.round(Number(refundForm.amount) * 100)
  const tuitionAmount = Math.round(Number(refundForm.tuitionAmount) * 100)
  if (!amount || tuitionAmount < 0 || tuitionAmount > amount || !refundForm.reason.trim()) {
    toast.add({ color: 'warning', title: 'Enter a valid refund amount, tuition portion, and reason' })
    return
  }
  if (!confirm(`Record a ${formatCurrency(amount)} refund against ${receipt.receiptNumber}? This creates a permanent financial record.`)) return
  submittingRefund.value = true
  try {
    await $fetch(`/api/payments/${receipt.id}/refunds`, {
      method: 'POST',
      body: {
        amount,
        tuitionAmount,
        refundedAt: refundForm.refundedAt,
        method: refundForm.method,
        referenceNumber: refundForm.referenceNumber.trim() || undefined,
        reason: refundForm.reason.trim(),
      },
    })
    refundingPaymentId.value = null
    await refresh()
    toast.add({ color: 'success', title: 'Refund recorded', description: 'The balance and finance reports have been updated.' })
  } catch (error: unknown) {
    toast.add({ color: 'error', title: 'Could not record refund', description: apiErrorMessage(error) })
  } finally {
    submittingRefund.value = false
  }
}
</script>
