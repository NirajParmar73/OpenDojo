<template>
  <div class="text-center" :class="roomy ? 'py-12' : 'py-10'">
    <UIcon :name="icon" class="mx-auto text-slate-300 dark:text-slate-600" :class="roomy ? 'h-8 w-8' : 'h-7 w-7'" />
    <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">
      {{ message }}
    </p>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  icon: string
  message: string
  roomy?: boolean
}>(), {
  roomy: false
})
</script>
