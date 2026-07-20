<template>
  <NuxtPage v-if="$route.path !== '/finance'" />
  <div v-else class="mx-auto max-w-7xl">
    <section class="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p class="text-sm font-semibold text-primary">FINANCE</p><h2 class="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Collections overview</h2><p class="mt-2 text-sm text-slate-500 dark:text-slate-400">See who needs a follow-up before their fee balance falls behind.</p></div>
      <div class="flex gap-3"><USelect v-model="selectedDojoId" :items="dojoOptions" placeholder="All accessible dojos" class="w-52" /><UButton to="/settings/finance/fee-plans" color="primary" variant="soft" icon="i-lucide-wallet-cards">Manage fee plans</UButton></div>
    </section>

    <div v-if="pending" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><USkeleton v-for="index in 4" :key="index" class="h-28 rounded-2xl" /></div>
    <UAlert v-else-if="error" color="error" title="Unable to load collections" :description="error.message" />
    <template v-else-if="overview">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Net revenue" :value="formatCurrency(overview.summary.netRevenue)" :description="`Collections ${formatCurrency(overview.summary.allTimeRevenue)} · Expenses ${formatCurrency(overview.summary.paidExpenses)}`" icon="i-lucide-chart-no-axes-combined" tone="success" />
        <MetricCard label="Collected this month" :value="formatCurrency(overview.summary.collectedThisMonth)" :description="`Last month: ${formatCurrency(overview.summary.collectedPreviousMonth)}`" icon="i-lucide-circle-check-big" tone="primary" />
        <MetricCard label="Overdue amount" :value="formatCurrency(overview.summary.overdueAmount)" icon="i-lucide-triangle-alert" tone="error" />
        <MetricCard label="Students pending" :value="String(overview.summary.pendingStudents)" :description="`${overview.summary.overdueStudents} overdue`" icon="i-lucide-users-round" tone="warning" />
      </div>

      <section class="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <UCard>
          <template #header><div><h3 class="font-semibold">Revenue trend</h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Payments recorded over the last six months.</p></div></template>
          <div class="grid grid-cols-6 items-end gap-3 pt-4" style="height: 220px">
            <div v-for="month in overview.revenueTrend" :key="month.label" class="flex h-full min-w-0 flex-col justify-end gap-2 text-center">
              <p class="truncate text-xs font-medium" :title="formatCurrency(month.amount)">{{ formatCompactCurrency(month.amount) }}</p>
              <div class="rounded-t-lg bg-primary/85 transition" :style="{ height: `${trendHeight(month.amount)}%` }" />
              <p class="truncate text-[11px] text-slate-500 dark:text-slate-400">{{ month.label.split(' ')[0] }}</p>
            </div>
          </div>
        </UCard>
        <UCard>
          <template #header><div><h3 class="font-semibold">Revenue by payment method</h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">All recorded payments.</p></div></template>
          <div v-if="overview.paymentMethods.length" class="divide-y divide-slate-100 dark:divide-slate-800"><div v-for="method in overview.paymentMethods" :key="method.method" class="flex items-center justify-between gap-4 py-4"><p class="capitalize font-medium">{{ method.method.replaceAll('_', ' ') }}</p><p class="font-semibold">{{ formatCurrency(method.amount) }}</p></div></div>
          <p v-else class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No payments recorded yet.</p>
        </UCard>
      </section>

      <UCard class="mt-6">
        <template #header><div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h3 class="font-semibold">Fee collection records</h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">All fee assignments, with overdue balances first.</p></div><div class="flex flex-col gap-3 sm:flex-row"><UInput v-model="search" icon="i-lucide-search" placeholder="Search student or dojo" class="sm:w-64" /><USelect v-model="filter" :items="filterOptions" class="sm:w-36" /></div></div></template>
        <div v-if="filteredRecords.length" class="overflow-x-auto"><table class="min-w-full text-sm"><thead class="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800"><tr><th class="px-3 py-3">Student</th><th class="px-3 py-3">Dojo</th><th class="px-3 py-3">Fee plan</th><th class="px-3 py-3">Paid this month</th><th class="px-3 py-3">Fee periods</th><th class="px-3 py-3">Outstanding</th><th class="px-3 py-3">Status</th><th class="px-3 py-3"></th></tr></thead><tbody><tr v-for="record in filteredRecords" :key="record.assignmentId" class="border-b border-slate-100 last:border-0 dark:border-slate-800"><td class="px-3 py-4 font-medium">{{ record.studentName }}</td><td class="px-3 py-4 text-slate-600 dark:text-slate-300">{{ record.dojoName }}</td><td class="px-3 py-4"><p class="font-medium">{{ record.feePlanName }}</p><p class="mt-1 text-xs capitalize text-slate-400">{{ record.frequency }}</p></td><td class="px-3 py-4 font-medium text-green-600 dark:text-green-400">{{ formatCurrency(record.paidThisMonth) }}</td><td class="px-3 py-4"><p class="font-medium">{{ record.paidPeriods }} of {{ record.periodsDue }} paid</p><p class="mt-1 text-xs" :class="record.pendingPeriods ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'">{{ pendingPeriodLabel(record) }}</p></td><td class="px-3 py-4 font-semibold" :class="record.collectionStatus === 'overdue' ? 'text-red-600 dark:text-red-400' : record.collectionStatus === 'pending' ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'">{{ formatCurrency(record.outstandingAmount) }}</td><td class="px-3 py-4"><UBadge :color="record.collectionStatus === 'overdue' ? 'error' : record.collectionStatus === 'pending' ? 'warning' : 'success'" variant="subtle" class="capitalize">{{ record.collectionStatus }}</UBadge></td><td class="px-3 py-4 text-right"><UButton :to="`/students/${record.studentId}`" size="xs" color="primary" variant="soft">Open student</UButton></td></tr></tbody></table></div>
        <div v-else class="py-12 text-center"><UIcon name="i-lucide-circle-check-big" class="mx-auto h-8 w-8 text-green-500" /><p class="mt-3 font-medium">No {{ filter === 'all' ? '' : filter }} records found.</p><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Fee assignments will appear here once they are created.</p></div>
      </UCard>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const search = ref('')
const filter = ref('all')
const filterOptions = [{ label: 'All records', value: 'all' }, { label: 'Paid', value: 'paid' }, { label: 'Pending', value: 'pending' }, { label: 'Overdue', value: 'overdue' }]
const selectedDojoId = ref<number | null>(null)
const { data: reportScope } = await useFetch<any>('/api/reports/scope')
const { data: organization } = await useFetch<{ currency?: string }>('/api/organization/settings')
const dojoOptions = computed(() => [{ label: 'All accessible dojos', value: null }, ...((reportScope.value?.dojos || []).map((dojo: any) => ({ label: dojo.name, value: dojo.id })))] )
const { data: overview, pending, error } = await useFetch<any>(() => `/api/finance/overview${selectedDojoId.value ? `?dojoId=${selectedDojoId.value}` : ''}`)
const filteredRecords = computed(() => (overview.value?.records || []).filter((record: any) => {
  const query = search.value.toLowerCase().trim()
  const matchesSearch = !query || `${record.studentName} ${record.dojoName} ${record.feePlanName}`.toLowerCase().includes(query)
  const matchesFilter = filter.value === 'all' || record.collectionStatus === filter.value
  return matchesSearch && matchesFilter
}))
function formatCurrency(amount: number) { return new Intl.NumberFormat(undefined, { style: 'currency', currency: organization.value?.currency || 'USD' }).format(amount / 100) }
function formatCompactCurrency(amount: number) { return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(amount / 100) }
function formatDate(value: string | number | null) { return value ? new Date(value).toLocaleDateString() : '—' }
function trendHeight(amount: number) {
  const maximum = Math.max(...(overview.value?.revenueTrend || []).map((month: any) => month.amount), 1)
  return amount === 0 ? 3 : Math.max(8, Math.round((amount / maximum) * 100))
}
function pendingPeriodLabel(record: any) {
  if (!record.pendingPeriods) return 'Up to date'
  const unit = record.frequency === 'monthly' ? 'month' : record.frequency === 'quarterly' ? 'quarter' : record.frequency === 'annual' ? 'year' : 'payment'
  return `${record.pendingPeriods} ${unit}${record.pendingPeriods === 1 ? '' : 's'} pending`
}

const MetricCard = defineComponent({
  props: { label: { type: String, required: true }, value: { type: String, required: true }, description: { type: String, default: '' }, icon: { type: String, required: true }, tone: { type: String, default: 'primary' } },
  template: '<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div class="flex items-start justify-between gap-3"><div><p class="text-sm text-slate-500 dark:text-slate-400">{{ label }}</p><p class="mt-2 text-2xl font-semibold tracking-tight">{{ value }}</p><p v-if="description" class="mt-1 text-xs text-slate-400">{{ description }}</p></div><div class="rounded-xl bg-primary/10 p-2.5 text-primary"><UIcon :name="icon" class="h-5 w-5" /></div></div></div>',
})
</script>
