<template>
  <div class="mx-auto max-w-6xl">
    <section class="mb-6">
      <p class="text-sm font-semibold text-primary">OPERATIONS</p>
      <h2 class="mt-1 text-2xl font-semibold">Tournament results</h2>
      <p class="mt-2 text-sm text-slate-500">All registered entries start as Pending. Set placement when results are announced.</p>
    </section>

    <UCard>
      <UFormField label="Tournament">
        <USelect v-model="tournamentId" :items="tournamentOptions" placeholder="Select tournament" class="max-w-xl" />
      </UFormField>
    </UCard>

    <UCard v-if="tournamentId" class="mt-6">
      <template #header>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="font-semibold">Registered participants</h3>
            <p v-if="changedCount" class="mt-1 text-sm text-slate-500">{{ changedCount }} unsaved {{ changedCount === 1 ? 'change' : 'changes' }}</p>
          </div>
          <UButton icon="i-lucide-save" :loading="savingAll" :disabled="!changedCount || savingAll" @click="saveAll">Save all changes</UButton>
        </div>
      </template>

      <div class="border-b border-slate-100 p-4 dark:border-slate-800">
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <UFormField label="Student">
            <UInput v-model="filters.student" icon="i-lucide-search" placeholder="Search student" class="w-full" />
          </UFormField>
          <UFormField label="Age">
            <USelect v-model="filters.age" :items="ageFilterOptions" class="w-full" />
          </UFormField>
          <UFormField label="Event">
            <USelect v-model="filters.event" :items="eventFilterOptions" class="w-full" />
          </UFormField>
          <UFormField label="Competition category">
            <USelect v-model="filters.ageCategory" :items="categoryFilterOptions" class="w-full" />
          </UFormField>
          <UFormField label="Belt division">
            <USelect v-model="filters.beltDivision" :items="beltFilterOptions" class="w-full" />
          </UFormField>
          <UFormField label="Result">
            <UInput v-model="filters.result" icon="i-lucide-search" placeholder="Search result" class="w-full" />
          </UFormField>
          <UFormField label="Place secured">
            <USelect v-model="filters.place" :items="placeFilterOptions" class="w-full" />
          </UFormField>
          <UFormField label="Medal">
            <USelect v-model="filters.medal" :items="medalFilterOptions" class="w-full" />
          </UFormField>
        </div>
        <div class="mt-3 flex items-center justify-between gap-3 text-sm text-slate-500">
          <span>Showing {{ filteredEntries.length }} of {{ entries.length }} entries</span>
          <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-filter-x" :disabled="!hasActiveFilters" @click="resetFilters">Clear filters</UButton>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-[1050px] text-sm">
          <thead class="border-b border-slate-100 text-left text-xs uppercase text-slate-400 dark:border-slate-800">
            <tr><th class="sticky left-0 z-20 bg-white px-3 py-3 dark:bg-slate-900">Student</th><th class="px-3 py-3">Age</th><th class="px-3 py-3">Event</th><th class="px-3 py-3">Competition category</th><th class="px-3 py-3">Belt division</th><th class="px-3 py-3">Result</th><th class="px-3 py-3">Place secured</th><th class="px-3 py-3">Medal</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="entry in filteredEntries" :key="entry.id" class="border-b border-slate-100 last:border-0 dark:border-slate-800">
              <td class="sticky left-0 z-10 bg-white px-3 py-3 font-medium text-slate-900 shadow-[2px_0_4px_-3px_rgba(15,23,42,0.45)] dark:bg-slate-900 dark:text-white">{{ entry.student?.firstName }} {{ entry.student?.lastName }}</td>
              <td class="px-3 py-3">{{ ageAtTournament(entry.student?.dateOfBirth) || '—' }}</td>
              <td class="px-3 py-3 capitalize">{{ entry.eventType }}</td>
              <td class="px-3 py-3">{{ entry.ageCategory || '—' }}</td>
              <td class="px-3 py-3">{{ entry.beltDivision === 'brown_black' ? 'Brown / Black' : 'Colour' }}</td>
              <td class="px-3 py-3"><UInput v-model="entry.result" placeholder="Pending" /></td>
              <td class="px-3 py-3"><USelect :model-value="entry.placeSecured" :items="placeOptions" @update:model-value="setPlace(entry, $event)" /></td>
              <td class="px-3 py-3"><UBadge :color="medalFor(entry.placeSecured) ? 'warning' : 'neutral'" variant="subtle">{{ medalFor(entry.placeSecured) || '-' }}</UBadge></td>
              <td class="px-3 py-3"><UButton size="xs" :loading="savingId === entry.id" :disabled="savingAll" @click="save(entry)">Save</UButton></td>
            </tr>
            <tr v-if="!filteredEntries.length">
              <td colspan="9" class="px-3 py-10 text-center text-slate-500">No entries match the selected filters.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const tournamentId = ref<number | null>(null)
const entries = ref<any[]>([])
const savedEntries = ref<Record<number, { result: string | null, placeSecured: number | null }>>({})
const savingId = ref<number | null>(null)
const savingAll = ref(false)
const filters = reactive({ student: '', age: 'all', event: 'all', ageCategory: 'all', beltDivision: 'all', result: '', place: 'all' as 'all' | number | null, medal: 'all' })
const toast = useToast()
const { data: tournaments } = await useFetch<any[]>('/api/tournaments')

const tournamentOptions = computed(() => (tournaments.value || []).map(t => ({ label: `${t.name} - ${t.level}`, value: t.id })))
const placeOptions = [{ label: 'Pending', value: null }, { label: 'Did not win', value: 0 }, { label: '1st place', value: 1 }, { label: '2nd place', value: 2 }, { label: '3rd place', value: 3 }, { label: '4th place', value: 4 }]
const eventFilterOptions = [{ label: 'All events', value: 'all' }, { label: 'Kata', value: 'kata' }, { label: 'Kumite', value: 'kumite' }]
const beltFilterOptions = [{ label: 'All belt divisions', value: 'all' }, { label: 'Colour', value: 'colour' }, { label: 'Brown / Black', value: 'brown_black' }]
const placeFilterOptions = [{ label: 'All places', value: 'all' }, ...placeOptions]
const medalFilterOptions = [{ label: 'All medals', value: 'all' }, { label: 'Gold', value: 'gold' }, { label: 'Silver', value: 'silver' }, { label: 'Bronze', value: 'bronze' }, { label: 'No medal', value: 'none' }]
const ageFilterOptions = computed(() => [{ label: 'All ages', value: 'all' }, ...Array.from(new Set(entries.value.map(entry => ageAtTournament(entry.student?.dateOfBirth)).filter(Boolean))).sort((a, b) => Number(a) - Number(b)).map(age => ({ label: age, value: age }))])
const categoryFilterOptions = computed(() => [{ label: 'All categories', value: 'all' }, ...Array.from(new Set(entries.value.map(entry => entry.ageCategory || '__none__'))).sort().map(category => ({ label: category === '__none__' ? 'Not set' : category, value: category }))])
const filteredEntries = computed(() => entries.value.filter(entry => {
  const studentName = `${entry.student?.firstName || ''} ${entry.student?.lastName || ''}`.toLowerCase()
  if (filters.student.trim() && !studentName.includes(filters.student.trim().toLowerCase())) return false
  if (filters.age !== 'all' && ageAtTournament(entry.student?.dateOfBirth) !== filters.age) return false
  if (filters.event !== 'all' && entry.eventType !== filters.event) return false
  if (filters.ageCategory !== 'all' && (entry.ageCategory || '__none__') !== filters.ageCategory) return false
  if (filters.beltDivision !== 'all' && (entry.beltDivision || 'colour') !== filters.beltDivision) return false
  if (filters.result.trim() && !String(entry.result || '').toLowerCase().includes(filters.result.trim().toLowerCase())) return false
  if (filters.place !== 'all' && entry.placeSecured !== filters.place) return false
  if (filters.medal !== 'all' && (medalFor(entry.placeSecured).toLowerCase() || 'none') !== filters.medal) return false
  return true
}))
const hasActiveFilters = computed(() => filters.student !== '' || filters.age !== 'all' || filters.event !== 'all' || filters.ageCategory !== 'all' || filters.beltDivision !== 'all' || filters.result !== '' || filters.place !== 'all' || filters.medal !== 'all')
const changedEntries = computed(() => entries.value.filter(entry => isChanged(entry)))
const changedCount = computed(() => changedEntries.value.length)

watch(tournamentId, async id => {
  resetFilters()
  const tournamentEntries = id ? await $fetch<any[]>(`/api/tournaments/${id}/entries`) : []
  entries.value = tournamentEntries.map(entry => ({ ...entry, result: resultFor(entry) }))
  savedEntries.value = Object.fromEntries(entries.value.map(entry => [entry.id, snapshot(entry)]))
})

function resetFilters() {
  Object.assign(filters, { student: '', age: 'all', event: 'all', ageCategory: 'all', beltDivision: 'all', result: '', place: 'all', medal: 'all' })
}

function placementResult(place: number | null | undefined) {
  return place === 0 ? 'Did not win' : place === 1 ? '1st place' : place === 2 ? '2nd place' : place === 3 ? '3rd place' : place === 4 ? '4th place' : 'Pending'
}

function resultFor(entry: any) {
  const result = typeof entry.result === 'string' ? entry.result.trim() : ''
  return result && result.toLowerCase() !== 'pending' ? result : placementResult(entry.placeSecured)
}

function setPlace(entry: any, place: number | null) {
  entry.placeSecured = place
  entry.result = placementResult(place)
}

function snapshot(entry: any) {
  return { result: entry.result || null, placeSecured: entry.placeSecured ?? null }
}

function isChanged(entry: any) {
  const saved = savedEntries.value[entry.id]
  return !saved || saved.result !== (entry.result || null) || saved.placeSecured !== (entry.placeSecured ?? null)
}

function medalFor(place: number | null) {
  return place === 1 ? 'Gold' : place === 2 ? 'Silver' : place === 3 || place === 4 ? 'Bronze' : ''
}

function ageAtTournament(dateOfBirth?: string | null) {
  if (!dateOfBirth) return ''
  const tournament = (tournaments.value || []).find(item => item.id === tournamentId.value)
  const birth = new Date(dateOfBirth)
  const date = tournament?.ageCutoffDate ? new Date(tournament.ageCutoffDate) : tournament?.startDate ? new Date(tournament.startDate) : new Date()
  let age = date.getFullYear() - birth.getFullYear()
  if (date.getMonth() < birth.getMonth() || (date.getMonth() === birth.getMonth() && date.getDate() < birth.getDate())) age--
  return `${age}`
}

async function persist(entry: any) {
  if (!tournamentId.value) return
  await $fetch(`/api/tournaments/${tournamentId.value}/entries/${entry.id}`, {
    method: 'PATCH',
    body: {
      eventType: entry.eventType,
      beltDivision: entry.beltDivision || 'colour',
      ageCategory: entry.ageCategory || null,
      weightCategory: entry.weightCategory || null,
      result: entry.result || null,
      placeSecured: entry.placeSecured ?? null
    }
  })
  savedEntries.value[entry.id] = snapshot(entry)
}

async function save(entry: any) {
  savingId.value = entry.id
  try {
    await persist(entry)
    toast.add({ color: 'success', title: 'Result saved' })
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not save result', description: error.message })
  } finally {
    savingId.value = null
  }
}

async function saveAll() {
  const changes = [...changedEntries.value]
  if (!changes.length) return

  savingAll.value = true
  const results = await Promise.allSettled(changes.map(persist))
  savingAll.value = false

  const failed = results.filter(result => result.status === 'rejected')
  if (failed.length) {
    toast.add({ color: 'error', title: `${failed.length} result${failed.length === 1 ? '' : 's'} could not be saved`, description: 'The remaining changes are still available to retry.' })
    return
  }

  toast.add({ color: 'success', title: `${changes.length} tournament result${changes.length === 1 ? '' : 's'} saved` })
}
</script>
