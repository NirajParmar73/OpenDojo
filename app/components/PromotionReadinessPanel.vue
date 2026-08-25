<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div><h3 class="font-semibold">Promotion readiness</h3><p class="mt-1 text-sm text-slate-500">Eligibility combines syllabus progress, recent attendance, and grading fee status.</p></div>
        <div class="flex flex-wrap gap-2"><UButton size="sm" :color="readyOnly ? 'primary' : 'neutral'" :variant="readyOnly ? 'solid' : 'soft'" @click="toggleReadyOnly">{{ readyOnly ? 'Showing eligible' : 'Eligible only' }}</UButton><UButton v-if="bulkActions" size="sm" icon="i-lucide-calendar-plus" :disabled="!eligibleCandidates.length" @click="openBulkSchedule">Schedule eligible students</UButton></div>
      </div>
    </template>

    <div v-if="showBulkSchedule" class="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div class="flex flex-wrap items-start justify-between gap-3"><div><h4 class="font-semibold">Schedule grading</h4><p class="mt-1 text-sm text-slate-500">{{ selectedIds.length }} of {{ eligibleCandidates.length }} eligible students selected. A separate exam will be created for each dojo.</p></div><UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="closeBulkSchedule" /></div>
      <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <UFormField label="Exam name" required class="lg:col-span-2"><UInput v-model="bulkForm.name" placeholder="e.g. Autumn belt grading" /></UFormField>
        <UFormField label="Exam date" required><UInput v-model="bulkForm.scheduledAt" type="date" /></UFormField>
        <UFormField label="Registration deadline"><UInput v-model="bulkForm.registrationDeadline" type="date" /></UFormField>
        <UFormField :label="`Fee (${currencyCode})`"><UInput v-model.number="bulkForm.fee" type="number" min="0" step="0.01" /></UFormField>
      </div>
      <div class="mt-4 rounded-xl border border-slate-200 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-900/60"><div class="mb-2 flex items-center justify-between gap-3"><p class="text-sm font-medium">Include dojos</p><UButton size="xs" color="neutral" variant="ghost" @click="toggleAllDojos">{{ allDojosSelected ? 'Clear all' : 'Select all' }}</UButton></div><div class="flex flex-wrap gap-x-5 gap-y-2"><label v-for="dojo in eligibleDojos" :key="dojo.id" class="flex items-center gap-2 text-sm"><UCheckbox :model-value="selectedDojoIds.includes(dojo.id)" @update:model-value="toggleDojo(dojo.id, $event === true)" /> {{ dojo.name }} <span class="text-xs text-slate-400">({{ dojo.count }})</span></label></div></div>
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3"><label class="flex items-center gap-2 text-sm"><UCheckbox :model-value="allEligibleSelected" @update:model-value="toggleAllEligible($event === true)" /> Select all eligible students in chosen dojos</label><div class="flex gap-2"><UButton color="neutral" variant="ghost" @click="closeBulkSchedule">Cancel</UButton><UButton :loading="scheduling" :disabled="!selectedIds.length" @click="scheduleSelected">Create exams & register students</UButton></div></div>
    </div>

    <UAlert v-if="bulkResult" class="mb-4" color="success" :title="`${bulkResult.enrolled} students registered across ${bulkResult.exams.length} grading exam${bulkResult.exams.length === 1 ? '' : 's'}`" :description="bulkResult.skipped.length ? `${bulkResult.skipped.length} students were skipped because their eligibility changed.` : 'You can now confirm, withdraw, or update each candidate from Grading Exams.'"><template #actions><UButton to="/grading-exams" size="sm" color="success" variant="soft">Open grading exams</UButton></template></UAlert>
    <UAlert class="mb-4" color="primary" variant="subtle" :title="`${data?.threshold.attendance || 80}% attendance across at least ${data?.threshold.classes || 4} classes in ${data?.threshold.periodDays || 90} days`" description="Every candidate is rechecked when a grading exam is scheduled." />
    <div v-if="pending" class="space-y-3"><USkeleton v-for="index in 4" :key="index" class="h-14" /></div>
    <div v-else-if="visible.length" class="overflow-x-auto">
      <table class="min-w-[900px] w-full text-sm">
        <thead class="border-b text-left text-xs uppercase tracking-wide text-slate-400"><tr><th v-if="bulkActions" class="p-3"></th><th class="p-3">Student</th><th class="p-3">Dojo</th><th class="p-3">Progression</th><th class="p-3">Attendance</th><th class="p-3">Review</th><th class="p-3"></th></tr></thead>
        <tbody><tr v-for="item in visible" :key="item.studentId" class="border-b border-slate-100 dark:border-slate-800"><td v-if="bulkActions" class="p-3"><UCheckbox v-if="item.eligible" :model-value="selectedIds.includes(item.studentId)" :aria-label="`Select ${item.studentName}`" @update:model-value="toggleStudent(item.studentId, $event === true)" /></td><td class="p-3 font-medium">{{ item.studentName }}</td><td class="p-3">{{ item.dojoName }}</td><td class="p-3">{{ item.currentRank }} <span class="text-slate-400">→</span> {{ item.nextRank || 'Highest rank' }}</td><td class="p-3"><span class="font-medium" :class="item.attendanceRate >= data.threshold.attendance ? 'text-emerald-600' : 'text-amber-600'">{{ item.attendanceRate }}%</span><span class="ml-1 text-xs text-slate-500">({{ item.classesRecorded }} classes)</span></td><td class="p-3"><UBadge :color="item.eligible ? 'success' : 'warning'" variant="subtle">{{ item.eligible ? 'Eligible' : 'Needs review' }}</UBadge><p v-if="item.reasons.length" class="mt-1 max-w-72 text-xs text-slate-500">{{ item.reasons.join(' · ') }}</p></td><td class="p-3 text-right"><UButton :to="`/students/${item.studentId}`" size="xs" color="neutral" variant="soft">Open</UButton></td></tr></tbody>
      </table>
    </div>
    <p v-else class="py-8 text-center text-sm text-slate-500">No students match this view.</p>
  </UCard>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ bulkActions?: boolean }>(), { bulkActions: false })
const readyOnly = ref(false)
const toast = useToast()
const { data, pending, refresh } = await useFetch<any>('/api/grading-exams/eligibility')
const { data: organization } = await useFetch<{ currency?: string }>('/api/organization/settings', { immediate: props.bulkActions })
const { currencyCode, toMinor } = useMoney(() => organization.value?.currency)
const showBulkSchedule = ref(false)
const scheduling = ref(false)
const selectedIds = ref<number[]>([])
const selectedDojoIds = ref<number[]>([])
const bulkResult = ref<any>(null)
const bulkForm = reactive({ name: 'Belt grading', scheduledAt: '', registrationDeadline: '', fee: 0 })
const eligibleCandidates = computed(() => (data.value?.candidates || []).filter((item: any) => item.eligible))
const eligibleDojos = computed(() => [...new Map(eligibleCandidates.value.map((item: any) => [item.dojoId, { id: item.dojoId, name: item.dojoName, count: eligibleCandidates.value.filter((candidate: any) => candidate.dojoId === item.dojoId).length }])).values()] as Array<{ id: number, name: string, count: number }>)
const candidatesInSelectedDojos = computed(() => eligibleCandidates.value.filter((item: any) => selectedDojoIds.value.includes(item.dojoId)))
const allDojosSelected = computed(() => eligibleDojos.value.length > 0 && eligibleDojos.value.every(dojo => selectedDojoIds.value.includes(dojo.id)))
const allEligibleSelected = computed(() => candidatesInSelectedDojos.value.length > 0 && candidatesInSelectedDojos.value.every((item: any) => selectedIds.value.includes(item.studentId)))
const visible = computed(() => (data.value?.candidates || []).filter((item: any) => (!readyOnly.value || item.eligible) && (!showBulkSchedule.value || !item.eligible || selectedDojoIds.value.includes(item.dojoId))))
function openBulkSchedule() { selectedDojoIds.value = eligibleDojos.value.map(dojo => dojo.id); selectedIds.value = eligibleCandidates.value.map((item: any) => item.studentId); readyOnly.value = true; bulkResult.value = null; showBulkSchedule.value = true }
function closeBulkSchedule() { showBulkSchedule.value = false }
function toggleReadyOnly() { readyOnly.value = !readyOnly.value }
function toggleAllEligible(checked: boolean) { selectedIds.value = checked ? candidatesInSelectedDojos.value.map((item: any) => item.studentId) : selectedIds.value.filter(id => !candidatesInSelectedDojos.value.some((item: any) => item.studentId === id)) }
function toggleAllDojos() { selectedDojoIds.value = allDojosSelected.value ? [] : eligibleDojos.value.map(dojo => dojo.id); selectedIds.value = candidatesInSelectedDojos.value.map((item: any) => item.studentId) }
function toggleDojo(dojoId: number, checked: boolean) { selectedDojoIds.value = checked ? [...new Set([...selectedDojoIds.value, dojoId])] : selectedDojoIds.value.filter(id => id !== dojoId); selectedIds.value = candidatesInSelectedDojos.value.map((item: any) => item.studentId) }
function toggleStudent(studentId: number, checked: boolean) { selectedIds.value = checked ? [...new Set([...selectedIds.value, studentId])] : selectedIds.value.filter(id => id !== studentId) }
async function scheduleSelected() {
  if (!bulkForm.name.trim() || !bulkForm.scheduledAt) { toast.add({ color: 'warning', title: 'Enter an exam name and date' }); return }
  if (bulkForm.registrationDeadline && bulkForm.registrationDeadline > bulkForm.scheduledAt) { toast.add({ color: 'warning', title: 'Registration deadline must be on or before the exam date' }); return }
  scheduling.value = true
  try {
    bulkResult.value = await $fetch('/api/grading-exams/bulk-schedule', { method: 'POST', body: { studentIds: selectedIds.value, name: bulkForm.name.trim(), scheduledAt: bulkForm.scheduledAt, registrationDeadline: bulkForm.registrationDeadline || null, feeAmount: toMinor(bulkForm.fee), paymentTiming: 'exam_day' } })
    showBulkSchedule.value = false
    await refresh()
    toast.add({ color: 'success', title: 'Grading exams scheduled' })
  } catch (error: any) { toast.add({ color: 'error', title: 'Could not schedule grading', description: apiErrorMessage(error) }) } finally { scheduling.value = false }
}
</script>
