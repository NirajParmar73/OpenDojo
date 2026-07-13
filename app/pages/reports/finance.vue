<template>
  <div class="mx-auto max-w-6xl">
    <section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p class="text-sm font-semibold text-primary">INSIGHTS</p><h2 class="mt-1 text-2xl font-semibold">Revenue & expense report</h2><p class="mt-2 text-sm text-slate-500">Collections, paid operating expenses, and net revenue for your selected territory.</p></div><UButton icon="i-lucide-download" variant="soft" :disabled="!overview" @click="downloadCsv">Export CSV</UButton></section>
    <ReportScopeFilter v-model:dojo-id="selectedDojoId" class="mt-6" />
    <div v-if="pending" class="mt-6 grid gap-4 sm:grid-cols-3"><USkeleton v-for="index in 3" :key="index" class="h-28" /></div>
    <UAlert v-else-if="error" class="mt-6" color="error" title="Could not load financial report" :description="error.message" />
    <template v-else-if="overview"><div class="mt-6 grid gap-4 sm:grid-cols-3"><UCard><p class="text-sm text-slate-500">Fees collected</p><p class="mt-2 text-3xl font-semibold text-green-600">{{ formatCurrency(overview.summary.allTimeRevenue) }}</p></UCard><UCard><p class="text-sm text-slate-500">Paid expenses</p><p class="mt-2 text-3xl font-semibold text-red-600">{{ formatCurrency(overview.summary.paidExpenses) }}</p></UCard><UCard><p class="text-sm text-slate-500">Net revenue</p><p class="mt-2 text-3xl font-semibold" :class="overview.summary.netRevenue >= 0 ? 'text-primary' : 'text-red-600'">{{ formatCurrency(overview.summary.netRevenue) }}</p></UCard></div><UCard class="mt-6"><template #header><div><h3 class="font-semibold">Collection trend</h3><p class="mt-1 text-sm text-slate-500">Monthly fee collections over the last six months.</p></div></template><div class="grid h-64 grid-cols-6 items-end gap-4"><div v-for="month in overview.revenueTrend" :key="month.label" class="flex h-full flex-col justify-end gap-2 text-center"><p class="text-xs font-medium">{{ formatCurrency(month.amount) }}</p><div class="rounded-t-lg bg-primary" :style="{ height: `${height(month.amount)}%` }" /><p class="text-xs text-slate-500">{{ month.label.split(' ')[0] }}</p></div></div></UCard></template>
  </div>
</template>
<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const selectedDojoId = ref<number | null>(null)
const { data: overview, pending, error } = await useFetch<any>(() => `/api/finance/overview${selectedDojoId.value ? `?dojoId=${selectedDojoId.value}` : ''}`)
function formatCurrency(amount: number) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount / 100) }
function height(amount: number) { const max = Math.max(...(overview.value?.revenueTrend || []).map((item: any) => item.amount), 1); return amount ? Math.max(8, Math.round((amount / max) * 100)) : 3 }
function csvCell(value: string | number) { return `"${String(value).replaceAll('"', '""')}"` }
function downloadCsv() { if (!overview.value) return; const rows = [['Metric', 'Amount'], ['Fees collected', overview.value.summary.allTimeRevenue], ['Paid expenses', overview.value.summary.paidExpenses], ['Net revenue', overview.value.summary.netRevenue], [], ['Month', 'Collections'], ...overview.value.revenueTrend.map((month: any) => [month.label, month.amount])]; const blob = new Blob([rows.map(row => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'revenue-expense-report.csv'; link.click(); URL.revokeObjectURL(url) }
</script>
