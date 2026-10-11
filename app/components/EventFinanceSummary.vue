<template>
  <UCard v-if="rows.length" class="mt-6">
    <template #header><div class="flex flex-wrap items-center justify-between gap-3"><div><h3 class="font-semibold">Organization events</h3><p class="mt-1 text-sm text-slate-500">Each event has its own revenue and payment ledger, separate from regular tuition above.</p></div><UButton to="/events" variant="outline">View events</UButton></div></template>
    <div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead><tr><th class="p-3">Event</th><th class="p-3">Revenue</th><th class="p-3">Gross profit</th><th class="p-3">Net profit before tax</th><th class="p-3">Net collected</th><th class="p-3">Family balances</th><th class="p-3">Supplier balances</th><th class="p-3">Cash surplus</th></tr></thead><tbody><tr v-for="event in rows" :key="event.id" class="border-t border-slate-100 dark:border-slate-800"><td class="p-3"><NuxtLink :to="`/events/${event.id}`" class="font-medium text-primary">{{ event.name }}</NuxtLink><p class="text-xs text-slate-500">{{ event.status === 'completed' ? 'Completed' : 'Provisional result' }}</p></td><td v-for="key in ['revenue', 'grossProfit', 'netProfit', 'collected', 'outstanding', 'supplierDue', 'cashSurplus']" :key="key" class="p-3">{{ money(event.finances[key], event.currency) }}</td></tr></tbody></table></div>
  </UCard>
</template>
<script setup lang="ts">
const { data } = await useFetch<any>('/api/events', { key: 'finance-event-summary' })
const rows = computed(() => (data.value?.events || []).filter((event: any) => event.canManage))
function money(amount: number, currency: string) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount / 100) }
</script>
