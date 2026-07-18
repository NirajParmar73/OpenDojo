<template>
  <div class="mx-auto max-w-6xl">
    <section class="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="text-sm font-semibold text-primary">FINANCE</p>
        <h2 class="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Recent receipts</h2>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">The 20 most recent payments in the dojos you can access.</p>
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
            <tr><th class="px-3 py-3">Receipt</th><th class="px-3 py-3">Student</th><th class="px-3 py-3">Fee plan</th><th class="px-3 py-3">Date</th><th class="px-3 py-3">Amount</th><th class="px-3 py-3 text-right">Download</th></tr>
          </thead>
          <tbody>
            <tr v-for="receipt in receipts" :key="receipt.id" class="border-b border-slate-100 last:border-0 dark:border-slate-800">
              <td class="px-3 py-4 font-medium">{{ receipt.receiptNumber }}</td>
              <td class="px-3 py-4"><NuxtLink :to="`/students/${receipt.student.id}`" class="font-medium hover:text-primary">{{ receipt.student.name }}</NuxtLink><p class="mt-1 text-xs text-slate-400">{{ receipt.student.dojoName }}</p></td>
              <td class="px-3 py-4 text-slate-600 dark:text-slate-300">{{ receipt.feePlanName }}</td>
              <td class="px-3 py-4 text-slate-600 dark:text-slate-300">{{ formatDate(receipt.paymentDate) }}</td>
              <td class="px-3 py-4 font-medium">{{ formatCurrency(receipt.amount) }}</td>
              <td class="px-3 py-4 text-right"><UButton :href="`/api/payments/${receipt.id}/receipt`" external size="xs" color="primary" variant="soft" icon="i-lucide-download">PDF</UButton></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="py-12 text-center"><UIcon name="i-lucide-receipt-text" class="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" /><p class="mt-3 text-sm text-slate-500 dark:text-slate-400">No receipts have been created yet.</p></div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

type Receipt = { id: number, receiptNumber: string, amount: number, paymentDate: string, feePlanName: string, student: { id: number, name: string, dojoName: string } }
const { data: receipts, pending, error } = await useFetch<Receipt[]>('/api/payments/recent')
const { data: organization } = await useFetch<{ currency?: string }>('/api/organization/settings')

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: organization.value?.currency || 'INR' }).format(amount / 100)
}
</script>
