<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><UIcon name="i-lucide-scan-search" class="h-4 w-4" /></div>
      <div class="min-w-0 flex-1"><p class="text-sm font-medium">Report scope</p><p class="text-xs text-slate-500 dark:text-slate-400">Only dojos within your assigned territory are available.</p></div>
      <USelect v-model="dojoId" :items="dojoOptions" placeholder="All accessible dojos" class="sm:w-64" />
    </div>
  </div>
</template>
<script setup lang="ts">
const dojoId = defineModel<number | null>('dojoId', { default: null })
const { data: scope } = await useFetch<{ dojos: Array<{ id: number, name: string }> }>('/api/reports/scope')
const dojoOptions = computed(() => [{ label: 'All accessible dojos', value: null }, ...((scope.value?.dojos || []).map(dojo => ({ label: dojo.name, value: dojo.id })))] )
</script>
