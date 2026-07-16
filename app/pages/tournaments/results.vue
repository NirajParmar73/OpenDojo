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

      <div class="overflow-x-auto">
        <table class="min-w-[1050px] text-sm">
          <thead class="border-b border-slate-100 text-left text-xs uppercase text-slate-400 dark:border-slate-800">
            <tr><th class="px-3 py-3">Student</th><th class="px-3 py-3">Age</th><th class="px-3 py-3">Event</th><th class="px-3 py-3">Competition category</th><th class="px-3 py-3">Belt division</th><th class="px-3 py-3">Result</th><th class="px-3 py-3">Place secured</th><th class="px-3 py-3">Medal</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="entry in entries" :key="entry.id" class="border-b border-slate-100 last:border-0 dark:border-slate-800">
              <td class="px-3 py-3 font-medium">{{ entry.student?.firstName }} {{ entry.student?.lastName }}</td>
              <td class="px-3 py-3">{{ ageAtTournament(entry.student?.dateOfBirth) || '—' }}</td>
              <td class="px-3 py-3 capitalize">{{ entry.eventType }}</td>
              <td class="px-3 py-3">{{ entry.ageCategory || '—' }}</td>
              <td class="px-3 py-3">{{ entry.beltDivision === 'brown_black' ? 'Brown / Black' : 'Colour' }}</td>
              <td class="px-3 py-3"><UInput v-model="entry.result" placeholder="Pending" /></td>
              <td class="px-3 py-3"><USelect v-model="entry.placeSecured" :items="placeOptions" /></td>
              <td class="px-3 py-3"><UBadge :color="medalFor(entry.placeSecured) ? 'warning' : 'neutral'" variant="subtle">{{ medalFor(entry.placeSecured) || '-' }}</UBadge></td>
              <td class="px-3 py-3"><UButton size="xs" :loading="savingId === entry.id" :disabled="savingAll" @click="save(entry)">Save</UButton></td>
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
const toast = useToast()
const { data: tournaments } = await useFetch<any[]>('/api/tournaments')

const tournamentOptions = computed(() => (tournaments.value || []).map(t => ({ label: `${t.name} - ${t.level}`, value: t.id })))
const placeOptions = [{ label: 'Pending', value: null }, { label: '1st place', value: 1 }, { label: '2nd place', value: 2 }, { label: '3rd place', value: 3 }, { label: '4th place', value: 4 }]
const changedEntries = computed(() => entries.value.filter(entry => isChanged(entry)))
const changedCount = computed(() => changedEntries.value.length)

watch(tournamentId, async id => {
  entries.value = id ? await $fetch(`/api/tournaments/${id}/entries`) : []
  savedEntries.value = Object.fromEntries(entries.value.map(entry => [entry.id, snapshot(entry)]))
})

function snapshot(entry: any) {
  return { result: entry.result || null, placeSecured: entry.placeSecured || null }
}

function isChanged(entry: any) {
  const saved = savedEntries.value[entry.id]
  return !saved || saved.result !== (entry.result || null) || saved.placeSecured !== (entry.placeSecured || null)
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
      placeSecured: entry.placeSecured || null
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

<style scoped>
table th:first-child { position: sticky; left: 0; z-index: 2; background: rgb(15 23 42); }
table td:first-child { position: sticky; left: 0; z-index: 1; background: rgb(15 23 42); box-shadow: 2px 0 4px -3px rgba(0,0,0,.7); }
</style>
