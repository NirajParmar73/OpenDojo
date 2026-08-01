<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ label }}
        </p>
        <p class="mt-2 text-2xl font-semibold tracking-tight">
          {{ value }}
        </p>
        <p v-if="description" class="mt-1 text-xs text-slate-400">
          {{ description }}
        </p>
      </div>
      <div class="rounded-xl bg-primary/10 p-2.5 text-primary">
        <UIcon :name="icon" class="h-5 w-5" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  value: string
  description?: string
  icon: string
  tone?: string
}>(), {
  description: '',
  tone: 'primary'
})
</script>
