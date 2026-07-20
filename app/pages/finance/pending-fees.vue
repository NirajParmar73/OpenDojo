<template>
  <div class="mx-auto max-w-7xl">
    <section class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-sm font-semibold text-primary">FINANCE</p>
        <h2 class="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Pending fees</h2>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Follow up on every student with an outstanding fee balance, oldest unpaid period first.</p>
      </div>
      <div class="flex gap-3"><USelect v-model="selectedDojoId" :items="dojoOptions" placeholder="All accessible dojos" class="w-52" /><UButton to="/finance" color="neutral" variant="soft">Collections overview</UButton></div>
    </section>

    <div v-if="pending" class="mt-6 grid gap-3"><USkeleton v-for="index in 6" :key="index" class="h-16 rounded-xl" /></div>
    <UAlert v-else-if="error" class="mt-6" color="error" title="Unable to load pending fees" :description="error.message" />
    <template v-else>
      <section class="mt-6 grid gap-4 sm:grid-cols-3">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p class="text-sm text-slate-500">Students to follow up</p><p class="mt-2 text-3xl font-semibold">{{ records.length }}</p></div>
        <div class="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900/60 dark:bg-red-950/20"><p class="text-sm text-slate-500">Overdue balance</p><p class="mt-2 text-3xl font-semibold text-red-700 dark:text-red-300">{{ formatCurrency(overdueAmount) }}</p></div>
        <div class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p class="text-sm text-slate-500">Longest overdue</p><p class="mt-2 text-3xl font-semibold">{{ longestOverdue }} <span class="text-base font-normal text-slate-500">days</span></p></div>
      </section>

      <UCard class="mt-6">
        <template #header><div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 class="font-semibold">Outstanding fee ledger</h3><p class="mt-1 text-sm text-slate-500">“First unpaid period” shows where the outstanding balance begins.</p></div><UInput v-model="search" icon="i-lucide-search" placeholder="Search student or dojo" class="sm:w-64" /></div></template>
        <div v-if="filteredRecords.length" class="overflow-x-auto">
          <table class="min-w-[1000px] text-sm">
            <thead class="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
              <tr><th class="sticky left-0 z-20 min-w-48 bg-slate-50 px-3 py-3 shadow-[2px_0_4px_-3px_rgba(15,23,42,0.45)] dark:bg-slate-950">Student</th><th class="px-3 py-3">Dojo</th><th class="px-3 py-3">Fee plan</th><th class="px-3 py-3">First unpaid period</th><th class="px-3 py-3">Pending periods</th><th class="px-3 py-3">Outstanding</th><th class="px-3 py-3">Pending for</th><th class="px-3 py-3"></th></tr>
            </thead>
            <tbody>
              <tr v-for="record in filteredRecords" :key="record.assignmentId" class="border-b border-slate-100 last:border-0 dark:border-slate-800"><td class="sticky left-0 z-10 min-w-48 bg-white px-3 py-4 font-medium shadow-[2px_0_4px_-3px_rgba(15,23,42,0.45)] dark:bg-slate-900">{{ record.studentName }}</td><td class="px-3 py-4 text-slate-600 dark:text-slate-300">{{ record.dojoName }}</td><td class="px-3 py-4"><p class="font-medium">{{ record.feePlanName }}</p><p class="mt-1 text-xs capitalize text-slate-400">{{ record.frequency }}</p></td><td class="px-3 py-4">{{ formatMonth(record.firstUnpaidDueDate) }}</td><td class="px-3 py-4">{{ record.pendingPeriods }}</td><td class="px-3 py-4 font-semibold text-red-600 dark:text-red-400">{{ formatCurrency(record.outstandingAmount) }}</td><td class="px-3 py-4"><UBadge :color="record.daysOverdue ? 'error' : 'warning'" variant="subtle">{{ record.daysOverdue ? `${record.daysOverdue} days overdue` : 'Due this period' }}</UBadge></td><td class="px-3 py-4 text-right"><UButton :to="`/fees?id=${record.studentId}`" size="xs" color="primary" variant="soft">Record payment</UButton></td></tr>
            </tbody>
          </table>
        </div>
        <div v-else class="py-12 text-center"><UIcon name="i-lucide-circle-check-big" class="mx-auto h-8 w-8 text-green-500" /><p class="mt-3 font-medium">No pending fees in this scope.</p></div>
      </UCard>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const search = ref('')
const selectedDojoId = ref<number | null>(null)
const { data: reportScope } = await useFetch<any>('/api/reports/scope')
const { data: organization } = await useFetch<{ currency?: string }>('/api/organization/settings')
const dojoOptions = computed(() => [{ label: 'All accessible dojos', value: null }, ...((reportScope.value?.dojos || []).map((dojo: any) => ({ label: dojo.name, value: dojo.id })))] )
const { data: overview, pending, error } = await useFetch<any>(() => `/api/finance/overview${selectedDojoId.value ? `?dojoId=${selectedDojoId.value}` : ''}`)
const records = computed(() => (overview.value?.records || []).filter((record: any) => record.outstandingAmount > 0))
const filteredRecords = computed(() => { const term = search.value.trim().toLowerCase(); return records.value.filter((record: any) => !term || `${record.studentName} ${record.dojoName}`.toLowerCase().includes(term)) })
const overdueAmount = computed(() => records.value.filter((record: any) => record.daysOverdue > 0).reduce((total: number, record: any) => total + record.outstandingAmount, 0))
const longestOverdue = computed(() => Math.max(0, ...records.value.map((record: any) => record.daysOverdue || 0)))
function formatCurrency(amount: number) { return new Intl.NumberFormat(undefined, { style: 'currency', currency: organization.value?.currency || 'USD' }).format(amount / 100) }
function formatMonth(value: string | null) { return value ? new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date(value)) : '—' }
</script>
