<template>
  <div>
    <dt class="text-xs font-medium uppercase tracking-wide text-slate-400">
      {{ label }}
    </dt>
    <dd class="mt-1 break-words text-sm font-medium" :class="{ capitalize }">
      {{ displayValue }}
    </dd>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string
  value?: string | number | null
  capitalize?: boolean
}>()

const displayValue = computed(() => props.value === null || props.value === undefined || props.value === '' ? 'Not provided' : props.value)
</script>
