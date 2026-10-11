<template>
  <div class="mx-auto max-w-6xl">
    <section class="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p class="text-sm font-semibold text-primary">{{ portal ? 'STUDENT PORTAL' : 'OPERATIONS' }}</p><h2 class="mt-1 text-3xl font-semibold">Events & camps</h2><p class="mt-2 text-slate-500">{{ portal ? 'Register yourself and accompanying parents, and follow your bookings.' : 'Bring registrations, camp operations and event finances together.' }}</p></div><UButton v-if="data?.canCreate" to="/events/new" icon="i-lucide-plus">Create event</UButton></section>
    <USkeleton v-if="pending" class="h-48" />
    <UAlert v-else-if="error" color="error" title="Events could not load" :description="error.data?.statusMessage || error.message" />
    <template v-else-if="data">
      <div class="mb-5 flex flex-wrap gap-3"><UInput v-model="search" placeholder="Search events" icon="i-lucide-search" aria-label="Search events" /><USelect v-model="filter" :items="['all', 'open', 'draft', 'closed', 'completed', 'cancelled']" aria-label="Filter event status" /></div>
      <div v-if="filtered.length" class="grid gap-5 md:grid-cols-2">
        <NuxtLink v-for="event in filtered" :key="event.id" :to="`${portal ? '/portal' : ''}/events/${event.id}`" class="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-primary hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div class="flex items-start justify-between gap-3"><div class="rounded-xl bg-primary/10 p-3 text-primary"><UIcon name="i-lucide-tent-tree" class="h-6 w-6" /></div><UBadge :color="event.status === 'open' ? 'success' : 'neutral'" class="capitalize">{{ event.status }}</UBadge></div>
          <h3 class="mt-4 text-xl font-semibold">{{ event.name }}</h3><p class="mt-1 text-sm text-slate-500">{{ event.startDate }} – {{ event.endDate }} · {{ event.venue || 'Venue to be announced' }}</p>
          <p class="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{{ event.description || 'View event details and registration options.' }}</p>
          <div class="mt-5 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4 text-sm dark:border-slate-800"><span>{{ event.occupancy.people }}{{ event.capacity ? ` / ${event.capacity}` : '' }} places reserved</span><span class="font-medium text-primary">{{ event.bookingCount }} {{ portal ? 'your bookings' : 'accessible bookings' }} →</span></div>
          <div v-if="event.finances" class="mt-3 flex justify-between gap-3 text-sm"><span>Collected {{ format(event.finances.collected, event.currency) }}</span><span>Forecast {{ format(event.finances.forecastProfit, event.currency) }}</span></div>
        </NuxtLink>
      </div>
      <UCard v-else><div class="py-12 text-center"><UIcon name="i-lucide-calendar-days" class="h-10 w-10 text-slate-400" /><h3 class="mt-3 text-lg font-semibold">No events to show</h3><p class="mt-2 text-sm text-slate-500">{{ portal ? 'Your dojo will publish upcoming camps and events here.' : 'Create your first camp or adjust the filters.' }}</p></div></UCard>
    </template>
  </div>
</template>
<script setup lang="ts">
const props = defineProps<{ portal?: boolean }>()
const { data, pending, error } = await useFetch<any>(props.portal ? '/api/portal/events' : '/api/events')
const search = ref(''); const filter = ref('all')
const filtered = computed(() => (data.value?.events || []).filter((event: any) => (filter.value === 'all' || event.status === filter.value) && `${event.name} ${event.venue}`.toLowerCase().includes(search.value.toLowerCase())))
function format(amount: number, currency: string) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount / 100) }
</script>
