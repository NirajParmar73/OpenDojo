<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div><h3 class="font-semibold">Promotion readiness</h3><p class="mt-1 text-sm text-slate-500">A review aid based on recent attendance—not an automatic promotion decision.</p></div>
        <UButton size="sm" :color="readyOnly ? 'primary' : 'neutral'" :variant="readyOnly ? 'solid' : 'soft'" @click="toggleReadyOnly">{{ readyOnly ? 'Showing ready' : 'Ready only' }}</UButton>
      </div>
    </template>
    <UAlert class="mb-4" color="primary" variant="subtle" :title="`${data?.threshold.attendance || 80}% attendance across at least ${data?.threshold.classes || 4} classes in ${data?.threshold.periodDays || 90} days`" description="Instructors retain the final assessment decision." />
    <div v-if="pending" class="space-y-3"><USkeleton v-for="index in 4" :key="index" class="h-14" /></div>
    <div v-else-if="visible.length" class="overflow-x-auto">
      <table class="min-w-[900px] w-full text-sm">
        <thead class="border-b text-left text-xs uppercase tracking-wide text-slate-400"><tr><th class="p-3">Student</th><th class="p-3">Dojo</th><th class="p-3">Progression</th><th class="p-3">Attendance</th><th class="p-3">Review</th><th class="p-3"></th></tr></thead>
        <tbody><tr v-for="item in visible" :key="item.studentId" class="border-b border-slate-100 dark:border-slate-800"><td class="p-3 font-medium">{{ item.studentName }}</td><td class="p-3">{{ item.dojoName }}</td><td class="p-3">{{ item.currentRank }} <span class="text-slate-400">→</span> {{ item.nextRank || 'Highest rank' }}</td><td class="p-3"><span class="font-medium" :class="item.attendanceRate >= data.threshold.attendance ? 'text-emerald-600' : 'text-amber-600'">{{ item.attendanceRate }}%</span><span class="ml-1 text-xs text-slate-500">({{ item.classesRecorded }} classes)</span></td><td class="p-3"><UBadge :color="item.eligible ? 'success' : 'warning'" variant="subtle">{{ item.eligible ? 'Ready for review' : 'Needs review' }}</UBadge><p v-if="item.reasons.length" class="mt-1 max-w-72 text-xs text-slate-500">{{ item.reasons.join(' · ') }}</p></td><td class="p-3 text-right"><UButton :to="`/students/${item.studentId}`" size="xs" color="neutral" variant="soft">Open</UButton></td></tr></tbody>
      </table>
    </div>
    <p v-else class="py-8 text-center text-sm text-slate-500">No students match this view.</p>
  </UCard>
</template>

<script setup lang="ts">
const readyOnly = ref(false)
const { data, pending } = await useFetch<any>('/api/grading-exams/eligibility')
const visible = computed(() => (data.value?.candidates || []).filter((item: any) => !readyOnly.value || item.eligible))
function toggleReadyOnly() { readyOnly.value = !readyOnly.value }
</script>
