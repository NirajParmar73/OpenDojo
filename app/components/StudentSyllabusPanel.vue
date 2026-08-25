<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div><h3 class="font-semibold">Next grading syllabus</h3><p class="mt-1 text-sm text-slate-500">{{ data?.targetRank ? `Preparing for ${data.targetRank.name}` : data?.reason || 'Progress will appear here.' }}</p></div>
        <UBadge v-if="data?.targetRank" :color="data.ready ? 'success' : 'warning'" variant="subtle">{{ data.ready ? 'Syllabus ready' : `${data.completed}/${data.total} ready` }}</UBadge>
      </div>
    </template>
    <div v-if="pending" class="space-y-3"><USkeleton class="h-14" /><USkeleton class="h-14" /></div>
    <UAlert v-else-if="error" color="error" title="Could not load syllabus progress" />
    <EmptyState v-else-if="!data?.version" icon="i-lucide-book-open-check" :message="data?.reason || 'No published syllabus is available for the next belt.'" />
    <div v-else class="space-y-5">
      <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full bg-emerald-500 transition-all" :style="{ width: `${percentage}%` }" /></div>
      <section v-for="section in data.sections" :key="section.id">
        <h4 class="mb-2 text-sm font-semibold">{{ section.name }}</h4>
        <div class="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          <div v-for="item in section.items" :key="item.id" class="flex flex-wrap items-center justify-between gap-3 p-3">
            <div class="min-w-0 flex-1"><p class="text-sm font-medium">{{ item.name }} <span v-if="!item.required" class="text-xs font-normal text-slate-400">Optional</span></p><p v-if="item.description" class="mt-1 text-xs text-slate-500">{{ item.description }}</p></div>
            <UButton v-if="data.canAssess" size="sm" :color="item.assessment?.status === 'ready' ? 'success' : 'neutral'" :variant="item.assessment?.status === 'ready' ? 'solid' : 'soft'" :loading="savingItemId === item.id" :icon="item.assessment?.status === 'ready' ? 'i-lucide-check' : 'i-lucide-circle'" @click="toggle(item)">{{ item.assessment?.status === 'ready' ? 'Ready' : 'Not ready' }}</UButton>
            <UBadge v-else :color="item.assessment?.status === 'ready' ? 'success' : 'neutral'" variant="subtle">{{ item.assessment?.status === 'ready' ? 'Ready' : 'Working on it' }}</UBadge>
          </div>
        </div>
      </section>
    </div>
  </UCard>
</template>

<script setup lang="ts">
const props = defineProps<{ studentId: number }>()
const toast = useToast()
const savingItemId = ref<number | null>(null)
const { data, pending, error, refresh } = await useFetch<any>(() => `/api/students/${props.studentId}/syllabus`)
const percentage = computed(() => data.value?.total ? Math.round((data.value.completed / data.value.total) * 100) : 0)
async function toggle(item: any) {
  savingItemId.value = item.id
  try { await $fetch(`/api/students/${props.studentId}/syllabus/items/${item.id}`, { method: 'PATCH', body: { status: item.assessment?.status === 'ready' ? 'not_ready' : 'ready' } }); await refresh() }
  catch (error: any) { toast.add({ color: 'error', title: 'Could not update readiness', description: apiErrorMessage(error) }) }
  finally { savingItemId.value = null }
}
</script>
