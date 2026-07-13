<template>
  <div class="mx-auto max-w-4xl">
    <section class="mb-7 max-w-2xl">
      <p class="text-sm font-semibold text-primary">INSIGHTS</p>
      <h2 class="mt-1 text-2xl font-semibold">Tournament achievement reports</h2>
      <p class="mt-2 text-sm leading-6 text-slate-500">Download a professional participation and medal summary for a tournament. Reports include only students from your permitted hierarchy and dojos.</p>
    </section>

    <UCard>
      <template #header><h3 class="font-semibold">Tournament summary</h3></template>
      <div v-if="tournaments?.length" class="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <UFormField label="Tournament">
          <USelect v-model="selectedTournamentId" :items="tournamentOptions" placeholder="Select a tournament" searchable class="w-full" />
        </UFormField>
        <UButton :disabled="!selectedTournamentId" icon="i-lucide-file-down" :loading="downloading" @click="download">Download PDF</UButton>
      </div>
      <UAlert v-else color="neutral" variant="subtle" icon="i-lucide-trophy" title="No tournament records in your territory" description="Record student achievements first; each tournament will then be available here." />
      <div v-if="selectedTournament" class="mt-6 grid gap-3 border-t border-slate-200 pt-5 text-sm sm:grid-cols-3 dark:border-slate-800">
        <div><p class="text-slate-500">Level</p><p class="mt-1 font-medium">{{ selectedTournament.level }}</p></div>
        <div><p class="text-slate-500">Venue</p><p class="mt-1 font-medium">{{ selectedTournament.venue || 'Not recorded' }}</p></div>
        <div><p class="text-slate-500">Visible participants</p><p class="mt-1 font-medium">{{ selectedTournament.participants }}</p></div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

type Tournament = { id: number, name: string, level: string, venue: string | null, startDate: string, participants: number }
const toast = useToast()
const selectedTournamentId = ref<number | null>(null)
const downloading = ref(false)
const { data: tournaments } = await useFetch<Tournament[]>('/api/reports/tournaments')
const tournamentOptions = computed(() => (tournaments.value || []).map(tournament => ({ label: `${tournament.name} — ${tournament.level} (${new Date(tournament.startDate).toLocaleDateString('en-IN')})`, value: tournament.id })))
const selectedTournament = computed(() => (tournaments.value || []).find(tournament => tournament.id === selectedTournamentId.value))

async function download() {
  if (!selectedTournamentId.value) return
  downloading.value = true
  try {
    const response = await fetch(`/api/reports/tournaments/${selectedTournamentId.value}`)
    if (!response.ok) throw new Error('Could not generate the tournament report')
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = 'tournament_achievement_report.pdf'
    link.click()
    URL.revokeObjectURL(url)
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not download report', description: error.message })
  } finally { downloading.value = false }
}
</script>
