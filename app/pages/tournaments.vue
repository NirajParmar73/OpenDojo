<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <section class="flex flex-wrap items-end justify-between gap-4">
      <div><p class="text-sm font-semibold text-primary">OPERATIONS</p><h2 class="mt-1 text-2xl font-semibold">Tournament setup</h2><p class="mt-2 text-sm text-slate-500">Create a tournament, share its participation form, and prepare the organizer's lists.</p></div>
      <UButton to="/tournament-results" color="neutral" variant="outline" icon="i-lucide-medal">Tournament results</UButton>
    </section>

    <UCard v-if="canCreate">
      <template #header><h3 class="font-semibold">{{ editingTournamentId ? 'Edit tournament' : 'Create tournament' }}</h3></template>
      <form class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" @submit.prevent="saveTournament">
        <UFormField label="Name" required><UInput v-model="form.name" required maxlength="200" class="w-full" /></UFormField>
        <UFormField label="Level" required><UInput v-model="form.level" required maxlength="100" class="w-full" /></UFormField>
        <UFormField label="Venue"><UInput v-model="form.venue" maxlength="300" class="w-full" /></UFormField>
        <UFormField label="Start date" required><UInput v-model="form.startDate" type="date" required class="w-full" /></UFormField>
        <UFormField label="End date"><UInput v-model="form.endDate" type="date" :min="form.startDate" class="w-full" /></UFormField>
        <UFormField label="Age cut-off date" help="Used to calculate ages in the form and Excel sheets." required><UInput v-model="form.ageCutoffDate" type="date" required class="w-full" /></UFormField>
        <UFormField label="Participant list heading" help="Defaults to your organization name followed by Participant List." class="sm:col-span-2"><UInput v-model="form.participantListTitle" maxlength="300" placeholder="e.g. Karate-Do Gojukai India, Ahmedabad Participant List" class="w-full" /></UFormField>
        <UFormField label="Coach" help="Printed after Coach: in both sheets."><UInput v-model="form.coachName" maxlength="200" class="w-full" /></UFormField>
        <div class="space-y-3 sm:col-span-2 lg:col-span-3">
          <UCheckbox v-if="permissions?.organizationWide && !editingTournamentId" v-model="organizationWide" label="Organization-wide participation form" />
          <UFormField v-if="!organizationWide" label="Participating locations" required help="This form belongs to these locations. Its location scope is fixed after creation."><USelect v-model="form.dojoIds" :items="permissions?.dojoOptions || []" multiple :disabled="!!editingTournamentId" placeholder="Select assigned locations" class="w-full" /></UFormField>
          <p v-else class="text-xs text-slate-500">Participation across the organization. Only organization owners and admins can manage this form.</p>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-4 sm:col-span-2 lg:col-span-3">
          <UCheckbox v-model="form.registrationEnabled" label="Accept public participation registrations" />
          <div class="flex gap-2"><UButton v-if="editingTournamentId" type="button" color="neutral" variant="ghost" @click="resetTournamentForm">Cancel</UButton><UButton type="submit" icon="i-lucide-plus" :loading="saving">{{ editingTournamentId ? 'Save tournament' : 'Create tournament & form' }}</UButton></div>
        </div>
      </form>
    </UCard>
    <UAlert v-if="permissionsError" color="error" title="Could not load tournament permissions" :description="permissionsError.message" />
    <UAlert v-else-if="permissions && !canCreate" color="neutral" title="Tournament form creation is unavailable" description="A manager or instructor needs an assigned location to create a participation form. Contact your organization administrator to update your assignments." />
    <UAlert v-if="tournamentsError" color="error" title="Could not load tournaments" :description="tournamentsError.message" />
    <UCard v-else-if="!tournaments?.length"><p class="py-6 text-center text-slate-500">{{ canCreate ? 'Create your first tournament to generate a participation form.' : 'No tournaments have been created yet.' }}</p></UCard>

    <UCard v-for="item in tournaments" :key="item.id">
      <template #header>
        <div class="flex flex-col justify-between gap-4 sm:flex-row">
          <div><h3 class="text-lg font-semibold">{{ item.name }}</h3><p class="mt-1 text-sm text-slate-500">{{ item.level }} · {{ formatDate(item.startDate) }} · {{ item.venue || 'Venue not set' }}</p><p class="mt-1 text-xs text-slate-500">Age cut-off: {{ formatDate(item.ageCutoffDate || item.startDate) }}</p><p class="mt-1 text-xs text-slate-500">{{ scopeLabel(item) }}</p></div>
          <div class="flex flex-wrap items-start gap-2"><UButton v-if="item.canManage" size="sm" color="neutral" variant="outline" @click="editTournament(item)">Edit</UButton><UButton v-if="item.canManage" size="sm" color="error" variant="ghost" @click="deleteTournament(item)">Delete</UButton><UButton size="sm" :variant="selectedId === item.id ? 'soft' : 'solid'" @click="selectTournament(item.id)">{{ selectedId === item.id ? 'Close roster' : 'Manage participants' }}</UButton></div>
        </div>
      </template>

      <div v-if="item.canManage" class="rounded-xl border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-900 dark:bg-teal-950/20">
        <div class="flex flex-wrap items-center justify-between gap-3"><div class="flex items-center gap-2"><UIcon name="i-lucide-link" class="size-4 text-primary" /><h4 class="text-sm font-semibold">Public participation form</h4><UBadge :color="item.registrationEnabled ? 'success' : 'neutral'" variant="subtle" size="sm">{{ item.registrationEnabled ? 'Open' : 'Closed' }}</UBadge></div><UButton size="xs" color="neutral" variant="outline" :loading="changingRegistration === item.id" @click="toggleRegistration(item)">{{ !item.registrationToken ? 'Generate form link' : item.registrationEnabled ? 'Close registration' : 'Reopen registration' }}</UButton></div>
        <div v-if="item.registrationToken" class="mt-3 flex flex-col gap-2 sm:flex-row"><UInput :model-value="registrationUrl(item)" readonly aria-label="Shareable participation form link" class="min-w-0 flex-1" /><UButton size="sm" icon="i-lucide-copy" color="neutral" variant="outline" @click="copyLink(item)">Copy link</UButton><UButton size="sm" icon="i-lucide-external-link" :href="registrationUrl(item)" target="_blank" color="neutral" variant="ghost">View form</UButton></div>
        <p class="mt-2 text-xs text-slate-500">Share this link with players. Each submission is saved to this tournament's roster and results.</p>
      </div>

      <template v-if="selectedId === item.id">
        <div class="my-5 flex flex-wrap items-center justify-between gap-3"><div><h4 class="font-semibold">Participation roster</h4><p class="mt-1 text-xs text-slate-500">{{ rosterRows.length }} players · {{ entries.length }} event entries</p></div><div class="flex gap-2"><UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-refresh-cw" :loading="loadingEntries" @click="loadEntries">Refresh</UButton><UButton size="sm" color="neutral" variant="outline" :to="{ path: '/tournament-results', query: { tournament: String(item.id) } }">Enter results</UButton></div></div>
        <div v-if="item.canExport" class="mb-5 space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950"><div><h4 class="text-sm font-semibold">Organizer participation lists</h4><p class="mt-1 text-xs text-slate-500">The supplied Excel layout, with one row per player. Close registration when the list is final.</p></div><TournamentParticipationDownloads :tournament-id="item.id" /></div>
        <UAlert v-if="rosterError" class="mb-4" color="error" title="Could not load participants" :description="rosterError" />
        <div v-if="loadingEntries" class="py-6"><USkeleton class="h-24" /></div>
        <div v-else class="space-y-5">
          <section v-for="group in participantGroups" :key="group.division" class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <h4 class="border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold dark:border-slate-800 dark:bg-slate-950">{{ group.title }} <span class="text-sm font-normal text-slate-500">({{ group.rows.length }})</span></h4>
            <div v-if="group.rows.length" class="overflow-x-auto"><table class="w-full whitespace-nowrap text-left text-sm"><thead class="text-xs text-slate-500"><tr><th class="px-4 py-3">Name</th><th class="px-3 py-3">Kata</th><th class="px-3 py-3">Kumite</th><th class="px-3 py-3">DOB</th><th class="px-3 py-3">Age</th><th class="px-3 py-3">Weight</th><th class="px-3 py-3">Belt</th><th class="px-3 py-3">M/F</th><th class="px-3 py-3">Category</th><th class="px-3 py-3"><span class="sr-only">Actions</span></th></tr></thead><tbody><tr v-for="person in group.rows" :key="person.key" class="border-t border-slate-100 dark:border-slate-800"><td class="px-4 py-3"><p class="font-medium">{{ person.fullName }}</p><p class="mt-1 text-xs text-slate-500">{{ person.participant ? 'Public registration' : 'Added by staff' }}</p></td><td class="px-3 py-3">{{ person.kata ? 'Yes' : 'No' }}</td><td class="px-3 py-3">{{ person.kumite ? 'Yes' : 'No' }}</td><td class="px-3 py-3">{{ formatDate(person.dateOfBirth) }}</td><td class="px-3 py-3">{{ person.dateOfBirth ? tournamentAge(person.dateOfBirth, item.ageCutoffDate || item.startDate) : '—' }}</td><td class="px-3 py-3">{{ person.weight || '—' }}</td><td class="px-3 py-3">{{ person.belt || '—' }}</td><td class="px-3 py-3">{{ person.gender || '—' }}</td><td class="px-3 py-3">{{ person.ageCategory || '—' }}</td><td class="px-3 py-3"><div v-if="item.canManage || !person.participant" class="flex gap-1"><UButton v-if="person.participant" size="xs" variant="ghost" @click="editPerson(person)">Edit</UButton><UButton v-for="value in person.participant ? [] : person.entries" :key="value.id" size="xs" variant="ghost" @click="editStaffEntry(value)">Edit {{ value.eventType }}</UButton><UButton size="xs" color="error" variant="ghost" @click="removePerson(person)">Remove</UButton></div></td></tr></tbody></table></div>
            <p v-else class="p-6 text-sm text-slate-500">No participants in this division yet.</p>
          </section>
        </div>

        <details class="mt-6 rounded-xl border border-slate-200 p-4 dark:border-slate-800" :open="!!editingId"><summary class="cursor-pointer text-sm font-medium">{{ editingId ? 'Edit staff entry' : 'Add an existing student manually' }}</summary><form class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" @submit.prevent="saveEntry"><UFormField label="Student" required><USelect v-model="entry.studentId" :items="studentOptions" required :disabled="!!editingId" class="w-full" /></UFormField><UFormField label="Event" required><USelect v-model="entry.eventType" :items="eventOptions" required class="w-full" /></UFormField><UFormField label="Belt division" required><USelect v-model="entry.beltDivision" :items="beltOptions" required class="w-full" /></UFormField><UFormField label="Competition category"><UInput v-model="entry.ageCategory" class="w-full" /></UFormField><UFormField label="Weight / weight category"><UInput v-model="entry.weightCategory" class="w-full" /></UFormField><div class="flex items-end gap-2"><UButton type="submit" :loading="savingEntry">{{ editingId ? 'Save entry' : 'Add participant' }}</UButton><UButton v-if="editingId" type="button" color="neutral" variant="ghost" @click="resetEntry">Cancel</UButton></div></form></details>
      </template>
    </UCard>

    <UModal v-model:open="participantModal" title="Edit participation details" description="Changes update the roster, event entries, and organizer's Excel list."><template #body><form class="space-y-5" @submit.prevent="saveParticipant"><TournamentParticipantFields v-if="selectedTournament" v-model="participantForm" :cutoff-date="selectedTournament.ageCutoffDate || selectedTournament.startDate" :belt-options="participantBeltOptions" /><UAlert v-if="participantError" color="error" title="Could not save participant" :description="participantError" /><p class="text-xs text-slate-500">Removing an event also removes its result. Results for events that remain selected are preserved.</p><div class="flex justify-end gap-2"><UButton type="button" color="neutral" variant="ghost" @click="closeParticipantModal">Cancel</UButton><UButton type="submit" :loading="savingParticipant">Save participant</UButton></div></form></template></UModal>
  </div>
</template>

<script setup lang="ts">
import { tournamentAge } from '#shared/utils/tournament-participation'
import type { TournamentBeltOption } from '#shared/utils/tournament-participation'
definePageMeta({ middleware: 'auth' })
const toast = useToast()
const { data: permissions, error: permissionsError } = await useFetch('/api/tournaments/permissions')
const canCreate = computed(() => !!permissions.value?.canCreate)
const organizationWide = ref(false)
const requestUrl = useRequestURL()
const saving = ref(false)
const savingEntry = ref(false)
const selectedId = ref<number | null>(null)
const editingId = ref<number | null>(null)
const editingTournamentId = ref<number | null>(null)
const entries = ref<any[]>([])
const loadingEntries = ref(false)
const rosterError = ref('')
const changingRegistration = ref<number | null>(null)
const blankTournament = () => ({ name: '', level: '', venue: '', startDate: '', endDate: '', ageCutoffDate: '', participantListTitle: '', coachName: '', registrationEnabled: true, dojoIds: [] as number[] })
const form = reactive(blankTournament())
const entry = reactive({ studentId: null as number | null, eventType: 'kata', beltDivision: 'colour', ageCategory: '', weightCategory: '' })
const { data: tournaments, refresh, error: tournamentsError } = await useFetch<any[]>('/api/tournaments')
const { data: students } = await useFetch<any[]>('/api/students')
const eventOptions = [{ label: 'Kata', value: 'kata' }, { label: 'Kumite', value: 'kumite' }]
const beltOptions = [{ label: 'Colour belts', value: 'colour' }, { label: 'Brown / Black belts', value: 'brown_black' }]
const studentOptions = computed(() => (students.value || []).filter(s => s.status === 'active' && (!selectedTournament.value?.dojoIds?.length || selectedTournament.value.dojoIds.includes(s.dojoId))).map(s => ({ label: `${s.firstName} ${s.lastName}`, value: s.id })))
const selectedTournament = computed(() => (tournaments.value || []).find(tournament => tournament.id === selectedId.value))
watch(permissions, value => { if (value && !editingTournamentId.value) { organizationWide.value = value.organizationWide; form.dojoIds = [...value.defaultDojoIds] } }, { immediate: true })
const rosterRows = computed(() => {
  const rows = new Map<string, any>()
  for (const value of entries.value) {
    const p = value.participant
    const key = p ? `participant-${p.id}` : `student-${value.studentId}-${value.beltDivision}`
    const row = rows.get(key) || { key, participant: p, fullName: p?.fullName || `${value.student?.firstName || ''} ${value.student?.lastName || ''}`.trim(), dateOfBirth: p?.dateOfBirth || value.student?.dateOfBirth, weight: p ? `${p.weightKg} kg` : value.weightCategory, belt: p?.belt || value.student?.currentBeltRank?.name, gender: p?.gender || (value.student?.gender === 'male' ? 'M' : value.student?.gender === 'female' ? 'F' : ''), ageCategory: p?.ageCategory || value.ageCategory, division: value.beltDivision || 'colour', kata: false, kumite: false, entries: [] }
    row[value.eventType] = true
    row.entries.push(value)
    rows.set(key, row)
  }
  return [...rows.values()]
})
const participantGroups = computed(() => [{ division: 'colour', title: 'Colour belt participants' }, { division: 'brown_black', title: 'Brown / Black belt participants' }].map(group => ({ ...group, rows: rosterRows.value.filter(row => row.division === group.division) })))
const participantModal = ref(false)
const participantId = ref<number | null>(null)
const participantForm = ref({ fullName: '', dateOfBirth: '', weightKg: undefined as number | undefined, gender: '', belt: '', ageCategory: '', kata: false, kumite: false })
const participantBeltOptions = computed<TournamentBeltOption[]>(() => {
  const options = permissions.value?.beltOptions || []
  const existing = entries.value.find(entry => entry.participantId === participantId.value)
  const belt = existing?.participant?.belt
  return belt && !options.some(option => option.value === belt) ? [...options, { label: belt, value: belt, division: existing.beltDivision === 'brown_black' ? 'brown_black' : 'colour' }] : options
})
const savingParticipant = ref(false)
const participantError = ref('')
function errorMessage(error: any) { return error.data?.statusMessage || error.message || 'Please try again.' }
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : '—' }
function dateInputValue(value?: string | null) { return value ? new Date(value).toISOString().slice(0, 10) : '' }
function scopeLabel(tournament: any) { return tournament.dojoIds?.length ? `Participating locations: ${tournament.dojoIds.map((id: number) => permissions.value?.dojoOptions.find(location => location.value === id)?.label || 'Location outside your scope').join(', ')}` : 'Organization-wide tournament' }
function registrationUrl(tournament: any) { return `${requestUrl.origin}/tournament-registration/${tournament.registrationToken}` }
function resetEntry() { Object.assign(entry, { studentId: null, eventType: 'kata', beltDivision: 'colour', ageCategory: '', weightCategory: '' }); editingId.value = null }
function resetTournamentForm() { Object.assign(form, blankTournament()); editingTournamentId.value = null; organizationWide.value = !!permissions.value?.organizationWide; form.dojoIds = [...(permissions.value?.defaultDojoIds || [])] }
function editTournament(tournament: any) { editingTournamentId.value = tournament.id; organizationWide.value = !tournament.dojoIds?.length; Object.assign(form, { ...tournament, dojoIds: [...(tournament.dojoIds || [])], startDate: dateInputValue(tournament.startDate), endDate: dateInputValue(tournament.endDate), ageCutoffDate: dateInputValue(tournament.ageCutoffDate || tournament.startDate), venue: tournament.venue || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
async function saveTournament() {
  saving.value = true
  try {
    if (!organizationWide.value && !form.dojoIds.length) throw new Error('Select at least one participating location.')
    const body = { ...form, dojoIds: organizationWide.value ? [] : form.dojoIds, venue: form.venue || undefined, endDate: form.endDate || undefined }
    const isEditing = !!editingTournamentId.value
    const saved = isEditing ? await $fetch<any>(`/api/tournaments/${editingTournamentId.value}`, { method: 'PATCH', body }) : await $fetch<any>('/api/tournaments', { method: 'POST', body })
    await refresh(); resetTournamentForm()
    selectedId.value = saved.id; await loadEntries()
    toast.add({ color: 'success', title: isEditing ? 'Tournament updated' : 'Tournament and participation form created' })
  } catch (error) { toast.add({ color: 'error', title: 'Could not save tournament', description: errorMessage(error) }) }
  finally { saving.value = false }
}
async function deleteTournament(tournament: any) {
  if (!confirm(`Delete ${tournament.name}? Public registrations and their results will be deleted. Existing student achievement history will be preserved.`)) return
  try {
    await $fetch(`/api/tournaments/${tournament.id}`, { method: 'DELETE' })
    if (selectedId.value === tournament.id) { selectedId.value = null; entries.value = [] }
    if (editingTournamentId.value === tournament.id) resetTournamentForm()
    await refresh(); toast.add({ color: 'success', title: 'Tournament deleted' })
  } catch (error) { toast.add({ color: 'error', title: 'Could not delete tournament', description: errorMessage(error) }) }
}
async function selectTournament(id: number) { if (selectedId.value === id) { selectedId.value = null; return }; selectedId.value = id; entries.value = []; resetEntry(); await loadEntries() }
async function loadEntries() {
  const id = selectedId.value
  if (!id) return
  loadingEntries.value = true; rosterError.value = ''
  try { const loaded = await $fetch<any[]>(`/api/tournaments/${id}/entries`); if (selectedId.value === id) entries.value = loaded }
  catch (error) { if (selectedId.value === id) rosterError.value = errorMessage(error) }
  finally { if (selectedId.value === id) loadingEntries.value = false }
}
async function toggleRegistration(tournament: any) {
  changingRegistration.value = tournament.id
  try { await $fetch(`/api/tournaments/${tournament.id}/registration`, { method: 'PATCH', body: { enabled: !tournament.registrationToken || !tournament.registrationEnabled } }); await refresh() }
  catch (error) { toast.add({ color: 'error', title: 'Could not change registration', description: errorMessage(error) }) }
  finally { changingRegistration.value = null }
}
async function copyLink(tournament: any) {
  try { await navigator.clipboard.writeText(registrationUrl(tournament)); toast.add({ color: 'success', title: 'Participation form link copied' }) }
  catch { toast.add({ color: 'error', title: 'Select and copy the link from the field above' }) }
}
async function saveEntry() {
  if (!selectedId.value || !entry.studentId) return
  savingEntry.value = true
  try { const url = editingId.value ? `/api/tournaments/${selectedId.value}/entries/${editingId.value}` : `/api/tournaments/${selectedId.value}/entries`; await $fetch(url, { method: editingId.value ? 'PATCH' : 'POST', body: entry }); await loadEntries(); resetEntry(); toast.add({ color: 'success', title: 'Participant saved' }) }
  catch (error) { toast.add({ color: 'error', title: 'Could not save entry', description: errorMessage(error) }) }
  finally { savingEntry.value = false }
}
function editStaffEntry(value: any) { editingId.value = value.id; Object.assign(entry, { studentId: value.studentId, eventType: value.eventType, beltDivision: value.beltDivision || 'colour', ageCategory: value.ageCategory || '', weightCategory: value.weightCategory || '' }) }
function editPerson(person: any) {
  if (!person.participant) { editStaffEntry(person.entries[0]); return }
  participantId.value = person.participant.id
  participantForm.value = { fullName: person.fullName, dateOfBirth: person.dateOfBirth, weightKg: person.participant.weightKg, gender: person.gender, belt: person.belt, ageCategory: person.ageCategory, kata: person.kata, kumite: person.kumite }
  participantError.value = ''; participantModal.value = true
}
function closeParticipantModal() { participantModal.value = false }
async function saveParticipant() {
  if (!selectedId.value || !participantId.value) return
  savingParticipant.value = true; participantError.value = ''
  try { await $fetch(`/api/tournaments/${selectedId.value}/participants/${participantId.value}`, { method: 'PATCH', body: { ...participantForm.value, weightKg: Number(participantForm.value.weightKg) } }); await loadEntries(); participantModal.value = false; toast.add({ color: 'success', title: 'Participation details updated' }) }
  catch (error) { participantError.value = errorMessage(error) }
  finally { savingParticipant.value = false }
}
async function removePerson(person: any) {
  if (!selectedId.value || !confirm(`Remove ${person.fullName} and all their event entries and results from this tournament?`)) return
  try {
    if (person.participant) await $fetch(`/api/tournaments/${selectedId.value}/participants/${person.participant.id}`, { method: 'DELETE' })
    else for (const value of person.entries) await $fetch(`/api/tournaments/${selectedId.value}/entries/${value.id}`, { method: 'DELETE' })
    await loadEntries()
  } catch (error) { toast.add({ color: 'error', title: 'Could not remove participant', description: errorMessage(error) }) }
}
</script>
