<template>
  <div class="mx-auto max-w-6xl">
    <section class="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8 sm:py-10">
      <div class="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/30 blur-3xl" />
      <div class="relative max-w-2xl">
        <p class="text-sm font-semibold text-violet-200">INSIGHTS</p>
        <h2 class="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Reports for your territory.</h2>
        <p class="mt-3 text-sm leading-6 text-slate-300 sm:text-base">Every report is limited to the organization locations and dojos assigned to you. Select a report, choose a scope, then download or share the result.</p>
        <div class="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-slate-200"><UIcon name="i-lucide-shield-check" class="h-4 w-4 text-violet-200" />{{ scopeMessage }}</div>
      </div>
    </section>

    <section class="mt-8 grid gap-5 md:grid-cols-3">
      <NuxtLink v-for="report in reports" :key="report.to" :to="report.to" class="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
        <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><UIcon :name="report.icon" class="h-6 w-6" /></div>
        <h3 class="mt-5 font-semibold">{{ report.title }}</h3>
        <p class="mt-2 flex-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{{ report.description }}</p>
        <div class="mt-5 flex items-center gap-1 text-sm font-medium text-primary">Open report <UIcon name="i-lucide-arrow-right" class="h-4 w-4 transition group-hover:translate-x-1" /></div>
      </NuxtLink>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { data: scope } = await useFetch<{ nodes: unknown[], dojos: unknown[] }>('/api/reports/scope')
const scopeMessage = computed(() => `Access to ${scope.value?.nodes.length || 0} hierarchy entities and ${scope.value?.dojos.length || 0} dojos`)
const reports = [
  { title: 'Student progress', description: 'Download a branded student journey report with attendance and grading history.', to: '/reports/student-progress', icon: 'i-lucide-file-badge' },
  { title: 'Attendance', description: 'Review attendance for a hierarchy entity or dojo, then download individual records.', to: '/reports/attendance', icon: 'i-lucide-calendar-check-2' },
  { title: 'Revenue & expenses', description: 'Compare fee collections, paid operating costs, and net revenue by dojo.', to: '/reports/finance', icon: 'i-lucide-chart-no-axes-combined' },
  { title: 'Tournament achievements', description: 'Download tournament participation, results, and medal summaries for your territory.', to: '/reports/tournaments', icon: 'i-lucide-trophy' },
]
</script>
