<template>
  <div class="mx-auto max-w-7xl">
    <section class="mb-6"><p class="text-sm font-semibold text-primary">INSTRUCTOR TOOLS</p><h2 class="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Promotion readiness</h2><p class="mt-2 text-sm text-slate-500">Review readiness independently or continue to Grading Exams to assign candidates.</p></section>
    <PromotionReadinessPanel />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
</script>
