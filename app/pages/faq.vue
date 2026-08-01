<template>
  <div class="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
    <nav class="text-sm text-slate-500" aria-label="Breadcrumb"><NuxtLink to="/help" class="hover:text-primary">Help Center</NuxtLink><span class="mx-2">/</span><span>FAQ</span></nav>
    <div class="mt-8 max-w-3xl"><p class="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Frequently asked questions</p><h1 class="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Clear answers to common questions.</h1><p class="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">For organization owners, staff, students, and families. Search or choose a topic below.</p></div>
    <div class="mt-8 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center"><div class="relative"><UIcon name="i-lucide-search" class="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-slate-400" /><input v-model="query" type="search" placeholder="Search questions and answers..." aria-label="Search frequently asked questions" class="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900" /></div><div class="flex flex-wrap gap-2"><button v-for="audience in audiences" :key="audience" class="rounded-full border px-3 py-2 text-xs font-semibold transition" :class="selectedAudience === audience ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'" @click="selectedAudience = audience">{{ audience }}</button></div></div>
    <p class="mt-5 text-sm text-slate-500">{{ filteredItems.length }} answer{{ filteredItems.length === 1 ? '' : 's' }}</p>
    <div v-if="filteredItems.length" class="mt-5 space-y-3">
      <details v-for="item in filteredItems" :id="item.id" :key="item.id" class="group scroll-mt-24 rounded-2xl border border-slate-200 bg-white shadow-sm open:border-primary/30 dark:border-slate-800 dark:bg-slate-900">
        <summary class="flex cursor-pointer list-none items-start justify-between gap-4 p-5 font-semibold sm:p-6"><span><span class="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{{ item.audience }}</span>{{ item.question }}</span><UIcon name="i-lucide-chevron-down" class="mt-1 h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180" /></summary>
        <div class="border-t border-slate-100 px-5 pb-6 pt-4 text-sm leading-7 text-slate-600 dark:border-slate-800 dark:text-slate-300 sm:px-6"><p>{{ item.answer }}</p><div v-if="item.links?.length" class="mt-4 flex flex-wrap gap-3"><NuxtLink v-for="link in item.links" :key="link.to" :to="link.to" class="inline-flex items-center gap-1 font-semibold text-primary hover:underline">{{ link.label }}<UIcon name="i-lucide-arrow-right" class="h-3.5 w-3.5" /></NuxtLink></div></div>
      </details>
    </div>
    <div v-else class="mt-5 rounded-3xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700"><UIcon name="i-lucide-message-circle-question" class="mx-auto h-8 w-8 text-slate-400" /><p class="mt-3 font-medium">No matching question</p><p class="mt-1 text-sm text-slate-500">Try fewer words or select All.</p></div>
    <section class="mt-12 rounded-3xl bg-primary/8 p-7 sm:flex sm:items-center sm:justify-between sm:gap-8"><div><h2 class="text-2xl font-semibold">Couldn’t find the answer?</h2><p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Browse the step-by-step guides or contact support with the details of your issue.</p></div><div class="mt-5 flex gap-2 sm:mt-0"><UButton to="/help" color="neutral" variant="outline">Browse guides</UButton><UButton to="/contact">Contact support</UButton></div></section>
  </div>
</template>

<script setup lang="ts">
import { faqItems } from '~/utils/help-content'
definePageMeta({ layout: 'help' })
useSeoMeta({ title: 'Frequently Asked Questions | OpenDojos', description: 'Answers to common OpenDojos questions about organizations, students, fees, attendance, access, accounts, and privacy.' })
const audiences = ['All', 'Organizations', 'Students', 'Accounts & privacy'] as const
const selectedAudience = ref<typeof audiences[number]>('All')
const query = ref('')
const filteredItems = computed(() => {
  const words = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return faqItems.filter(item => {
    const matchesAudience = selectedAudience.value === 'All' || item.audience === selectedAudience.value
    const text = `${item.question} ${item.answer} ${item.audience}`.toLowerCase()
    return matchesAudience && words.every(word => text.includes(word))
  })
})
</script>
