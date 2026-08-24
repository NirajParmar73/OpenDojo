<template>
  <div class="mx-auto max-w-6xl">
    <section class="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="max-w-2xl">
        <p class="text-sm font-semibold text-primary">INSIGHTS</p>
        <h2 class="mt-1 text-2xl font-semibold">Tournament performance report</h2>
        <p class="mt-2 text-sm leading-6 text-slate-500">Review winners, medal totals, competition categories, and dojo performance for your permitted territory.</p>
      </div>
      <UButton v-if="report" icon="i-lucide-file-down" :loading="downloading" @click="download">Download PDF</UButton>
    </section>

    <UCard>
      <div v-if="tournaments?.length" class="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <UFormField label="Tournament">
          <USelect v-model="selectedTournamentId" :items="tournamentOptions" placeholder="Select a tournament" searchable class="w-full" />
        </UFormField>
        <UButton :disabled="!selectedTournamentId" color="neutral" variant="soft" icon="i-lucide-bar-chart-3" :loading="loadingReport" @click="loadReport">Generate report</UButton>
      </div>
      <UAlert v-else color="neutral" variant="subtle" icon="i-lucide-trophy" title="No tournament records in your territory" description="Record student achievements first; each tournament will then be available here." />
    </UCard>

    <div v-if="loadingReport" class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <USkeleton v-for="item in 8" :key="item" class="h-28 rounded-xl" />
    </div>

    <div v-else-if="report" class="mt-6 space-y-6">
      <UCard>
        <div class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-4">
            <div class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
              <img v-if="report.organization?.logo" :src="report.organization.logo" :alt="report.organization.name" class="max-h-14 max-w-14 object-contain">
              <UIcon v-else name="i-lucide-trophy" class="size-8 text-primary" />
            </div>
            <div>
              <p class="text-sm font-medium text-primary">{{ report.organization?.name || 'OpenDojos' }}</p>
              <h3 class="mt-1 text-xl font-semibold">{{ report.tournament.name }}</h3>
              <p class="mt-1 text-sm text-slate-500">{{ report.tournament.level }} · {{ report.tournament.venue || 'Venue not recorded' }} · {{ formatDateRange(report.tournament.startDate, report.tournament.endDate) }}</p>
            </div>
          </div>
          <div class="rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/60">
            <p class="text-slate-500">Age cut-off</p>
            <p class="mt-1 font-medium">{{ formatDate(report.tournament.ageCutoffDate || report.tournament.startDate) }}</p>
          </div>
        </div>
      </UCard>

      <section>
        <h3 class="mb-3 font-semibold">Executive summary</h3>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="stat in summaryStats" :key="stat.label" class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm text-slate-500">{{ stat.label }}</p>
              <UIcon :name="stat.icon" class="size-5" :class="stat.color" />
            </div>
            <p class="mt-2 text-2xl font-semibold">{{ stat.value }}</p>
          </div>
        </div>
      </section>

      <div class="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <UCard>
          <template #header><h3 class="font-semibold">Medal tally</h3></template>
          <div class="space-y-4">
            <div v-for="medal in medalStats" :key="medal.label" class="flex items-center justify-between rounded-xl p-4" :class="medal.background">
              <div class="flex items-center gap-3"><UIcon name="i-lucide-medal" class="size-6" :class="medal.color" /><span class="font-medium">{{ medal.label }}</span></div>
              <span class="text-2xl font-semibold">{{ medal.value }}</span>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div><h3 class="font-semibold">Dojo performance</h3><p class="mt-1 text-xs text-slate-500">Ranked by Gold × 3, Silver × 2, Bronze × 1; medal rate is winning entries ÷ total entries.</p></div>
          </template>
          <div class="overflow-x-auto">
            <table class="min-w-[650px] w-full text-sm">
              <thead class="border-b text-left text-xs uppercase text-slate-400 dark:border-slate-800"><tr><th class="py-2 pr-3">Rank / dojo</th><th class="px-2 py-2">Competitors</th><th class="px-2 py-2">Entries</th><th class="px-2 py-2">G</th><th class="px-2 py-2">S</th><th class="px-2 py-2">B</th><th class="px-2 py-2">Rate</th><th class="py-2 pl-2">Points</th></tr></thead>
              <tbody><tr v-for="(dojo, index) in report.dojos" :key="dojo.dojoName" class="border-b last:border-0 dark:border-slate-800"><td class="py-3 pr-3 font-medium"><span class="mr-2 text-slate-400">{{ Number(index) + 1 }}</span>{{ dojo.dojoName }}</td><td class="px-2 py-3">{{ dojo.competitors }}</td><td class="px-2 py-3">{{ dojo.entries }}</td><td class="px-2 py-3">{{ dojo.gold }}</td><td class="px-2 py-3">{{ dojo.silver }}</td><td class="px-2 py-3">{{ dojo.bronze }}</td><td class="px-2 py-3">{{ dojo.medalRate }}%</td><td class="py-3 pl-2 font-semibold">{{ dojo.points }}</td></tr></tbody>
            </table>
          </div>
        </UCard>
      </div>

      <UCard>
        <template #header><div><h3 class="font-semibold">Category performance</h3><p class="mt-1 text-xs text-slate-500">Breakdown by belt division, competition age category, and event.</p></div></template>
        <div class="overflow-x-auto">
          <table class="min-w-[760px] w-full text-sm">
            <thead class="border-b text-left text-xs uppercase text-slate-400 dark:border-slate-800"><tr><th class="py-2 pr-3">Belt division</th><th class="px-2 py-2">Age category</th><th class="px-2 py-2">Event</th><th class="px-2 py-2">Competitors</th><th class="px-2 py-2">Entries</th><th class="px-2 py-2">Gold</th><th class="px-2 py-2">Silver</th><th class="py-2 pl-2">Bronze</th></tr></thead>
            <tbody><tr v-for="category in report.categories" :key="`${category.beltDivision}-${category.ageCategory}-${category.eventType}`" class="border-b last:border-0 dark:border-slate-800"><td class="py-3 pr-3 font-medium">{{ category.beltDivisionLabel }}</td><td class="px-2 py-3">{{ category.ageCategory }}</td><td class="px-2 py-3 capitalize">{{ category.eventType }}</td><td class="px-2 py-3">{{ category.competitors }}</td><td class="px-2 py-3">{{ category.entries }}</td><td class="px-2 py-3">{{ category.gold }}</td><td class="px-2 py-3">{{ category.silver }}</td><td class="py-3 pl-2">{{ category.bronze }}</td></tr></tbody>
          </table>
        </div>
      </UCard>

      <UCard>
        <template #header><div><h3 class="font-semibold">Tournament winners</h3><p class="mt-1 text-xs text-slate-500">All medal-winning entries, ordered by belt division, category, event, and place.</p></div></template>
        <div v-if="report.winners.length" class="overflow-x-auto">
          <table class="min-w-[1000px] w-full text-sm">
            <thead class="border-b text-left text-xs uppercase text-slate-400 dark:border-slate-800"><tr><th class="py-2 pr-3">Student</th><th class="px-2 py-2">Age</th><th class="px-2 py-2">Dojo</th><th class="px-2 py-2">Belt division</th><th class="px-2 py-2">Category</th><th class="px-2 py-2">Event</th><th class="px-2 py-2">Result</th><th class="py-2 pl-2">Medal</th></tr></thead>
            <tbody><tr v-for="winner in report.winners" :key="winner.id" class="border-b last:border-0 dark:border-slate-800"><td class="py-3 pr-3 font-medium">{{ winner.studentName }}</td><td class="px-2 py-3">{{ winner.age ?? '—' }}</td><td class="px-2 py-3">{{ winner.dojoName }}</td><td class="px-2 py-3">{{ winner.beltDivisionLabel }}</td><td class="px-2 py-3">{{ winner.ageCategory }}<span v-if="winner.weightCategory" class="text-slate-500"> · {{ winner.weightCategory }}</span></td><td class="px-2 py-3 capitalize">{{ winner.eventType }}</td><td class="px-2 py-3">{{ winner.result }}</td><td class="py-3 pl-2"><UBadge color="warning" variant="subtle" class="capitalize">{{ winner.medal }}</UBadge></td></tr></tbody>
          </table>
        </div>
        <p v-else class="py-8 text-center text-sm text-slate-500">No winners have been recorded for this tournament.</p>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

type Tournament = { id: number, name: string, level: string, venue: string | null, startDate: string, ageCutoffDate: string | null, participants: number }
const toast = useToast()
const selectedTournamentId = ref<number | undefined>()
const downloading = ref(false)
const loadingReport = ref(false)
const report = ref<any>(null)
const { data: tournaments } = await useFetch<Tournament[]>('/api/reports/tournaments')
const tournamentOptions = computed(() => (tournaments.value || []).map(tournament => ({ label: `${tournament.name} — ${tournament.level} (${new Date(tournament.startDate).toLocaleDateString('en-IN')})`, value: tournament.id })))
const summaryStats = computed(() => report.value ? [
  { label: 'Competitors', value: report.value.summary.competitors, icon: 'i-lucide-users', color: 'text-primary' },
  { label: 'Event entries', value: report.value.summary.entries, icon: 'i-lucide-list-checks', color: 'text-sky-600' },
  { label: 'Medalists', value: report.value.summary.medalists, icon: 'i-lucide-award', color: 'text-amber-600' },
  { label: 'Total medals', value: report.value.summary.totalMedals, icon: 'i-lucide-medal', color: 'text-orange-600' },
  { label: 'Pending results', value: report.value.summary.pending, icon: 'i-lucide-clock-3', color: 'text-slate-500' },
  { label: 'Did not win', value: report.value.summary.didNotWin, icon: 'i-lucide-minus-circle', color: 'text-slate-500' },
  { label: 'Categories', value: report.value.categories.length, icon: 'i-lucide-layout-grid', color: 'text-violet-600' },
  { label: 'Dojos represented', value: report.value.dojos.length, icon: 'i-lucide-building-2', color: 'text-emerald-600' },
] : [])
const medalStats = computed(() => report.value ? [
  { label: 'Gold', value: report.value.summary.gold, color: 'text-amber-600', background: 'bg-amber-50 dark:bg-amber-950/30' },
  { label: 'Silver', value: report.value.summary.silver, color: 'text-slate-500', background: 'bg-slate-100 dark:bg-slate-800' },
  { label: 'Bronze', value: report.value.summary.bronze, color: 'text-orange-700', background: 'bg-orange-50 dark:bg-orange-950/30' },
] : [])

function formatDate(value: string) { return new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' }) }
function formatDateRange(start: string, end?: string | null) { return `${formatDate(start)}${end ? ` – ${formatDate(end)}` : ''}` }

async function loadReport() {
  if (!selectedTournamentId.value) return
  loadingReport.value = true
  report.value = null
  try {
    report.value = await $fetch(`/api/reports/tournaments/${selectedTournamentId.value}/summary`)
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not generate report', description: error.message })
  } finally { loadingReport.value = false }
}

async function download() {
  if (!selectedTournamentId.value) return
  const preview = window.open('', '_blank')
  downloading.value = true
  try {
    const response = await fetch(`/api/reports/tournaments/${selectedTournamentId.value}`)
    if (!response.ok) throw new Error('Could not generate the tournament report')
    const url = URL.createObjectURL(await response.blob())
    if (preview) preview.location.href = url
    else window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (error: any) {
    preview?.close()
    toast.add({ color: 'error', title: 'Could not download report', description: error.message })
  } finally { downloading.value = false }
}
</script>
