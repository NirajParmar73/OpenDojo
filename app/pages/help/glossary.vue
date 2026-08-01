<template>
  <div class="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
    <nav class="text-sm text-slate-500" aria-label="Breadcrumb"><NuxtLink to="/help" class="hover:text-primary">Help Center</NuxtLink><span class="mx-2">/</span><span>Glossary</span></nav>
    <div class="mt-8 max-w-3xl"><p class="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Plain-language glossary</p><h1 class="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Technical terms, without the technical language.</h1><p class="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">Short definitions for the words you may see while using OpenDojos.</p></div>
    <div class="relative mt-8 max-w-xl"><UIcon name="i-lucide-search" class="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-slate-400" /><input v-model="query" type="search" placeholder="Search terms and definitions..." aria-label="Search the glossary" class="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900" /></div>
    <p class="mt-5 text-sm text-slate-500">Showing {{ filteredItems.length }} of {{ glossaryItems.length }} terms</p>
    <dl v-if="filteredItems.length" class="mt-5 divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
      <div v-for="item in filteredItems" :id="helpSlug(item.term)" :key="item.term" class="scroll-mt-24 p-6 sm:grid sm:grid-cols-[13rem_1fr] sm:gap-6 sm:p-7"><dt class="font-semibold text-slate-950 dark:text-white"><a :href="`#${helpSlug(item.term)}`" class="hover:text-primary">{{ item.term }}</a></dt><dd class="mt-2 text-sm leading-6 text-slate-600 sm:mt-0 dark:text-slate-300"><p>{{ item.definition }}</p><p v-if="item.example" class="mt-2 text-slate-500 dark:text-slate-400"><span class="font-medium">Example:</span> {{ item.example }}</p></dd></div>
    </dl>
    <div v-else class="mt-5 rounded-3xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700"><p class="font-medium">No matching term</p><p class="mt-2 text-sm text-slate-500">Try another word, or search the whole Help Center.</p><UButton to="/help" class="mt-5" color="neutral" variant="outline">Search Help Center</UButton></div>
  </div>
</template>

<script setup lang="ts">
import { glossaryItems, helpSlug } from '~/utils/help-content'
definePageMeta({ layout: 'help' })
useSeoMeta({ title: 'OpenDojos Glossary | Plain-language Definitions', description: 'Simple definitions for roles, scope, dojos, programs, fee plans, sessions, PWA, CSV, and other OpenDojos terms.' })
const query = ref('')
const filteredItems = computed(() => {
  const words = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return glossaryItems
  return glossaryItems.filter(item => words.every(word => `${item.term} ${item.definition} ${item.example || ''}`.toLowerCase().includes(word)))
})
</script>
