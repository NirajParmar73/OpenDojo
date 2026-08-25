<template>
  <div>
    <section class="border-b border-slate-200 bg-gradient-to-b from-primary/8 to-transparent dark:border-slate-800">
      <div class="mx-auto max-w-5xl px-5 py-16 text-center sm:px-8 sm:py-24">
        <p class="text-sm font-semibold uppercase tracking-[0.16em] text-primary">OpenDojos Help Center</p>
        <h1 class="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">What can we help you learn?</h1>
        <p class="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">Start with a role-based walkthrough, find a quick answer, or translate a technical term into everyday language.</p>
        <div class="relative mx-auto mt-8 max-w-2xl text-left">
          <UIcon name="i-lucide-search" class="pointer-events-none absolute left-4 top-4 h-5 w-5 text-slate-400" />
          <input v-model="query" type="search" placeholder="Search guides, questions, and terms..." aria-label="Search the Help Center" class="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-base shadow-lg outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900" />
        </div>
      </div>
    </section>

    <div class="mx-auto max-w-7xl px-5 py-12 sm:px-8">
      <section v-if="normalizedQuery">
        <div class="flex items-end justify-between gap-4"><div><p class="text-sm font-semibold text-primary">SEARCH RESULTS</p><h2 class="mt-1 text-2xl font-semibold">{{ results.length ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'No matching help found' }}</h2></div><button class="text-sm font-medium text-primary hover:underline" @click="query = ''">Clear search</button></div>
        <div v-if="results.length" class="mt-6 grid gap-3">
          <NuxtLink v-for="result in results" :key="`${result.type}-${result.title}`" :to="result.to" class="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary/40 dark:border-slate-800 dark:bg-slate-900"><div class="flex items-start justify-between gap-4"><div><p class="text-xs font-semibold uppercase tracking-wide text-primary">{{ result.type }}</p><h3 class="mt-1 text-lg font-semibold group-hover:text-primary">{{ result.title }}</h3><p class="mt-1 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{{ result.description }}</p></div><UIcon name="i-lucide-arrow-up-right" class="mt-1 h-5 w-5 shrink-0 text-slate-400 group-hover:text-primary" /></div></NuxtLink>
        </div>
        <div v-else class="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700"><UIcon name="i-lucide-search-x" class="mx-auto h-8 w-8 text-slate-400" /><p class="mt-3 text-slate-600 dark:text-slate-300">Try a shorter phrase such as “payment”, “student login”, or “scope”.</p></div>
      </section>

      <template v-else>
        <section class="grid gap-5 md:grid-cols-2">
          <NuxtLink to="/help/organizations" class="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 dark:border-slate-800 dark:bg-slate-900"><div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><UIcon name="i-lucide-building-2" class="h-6 w-6" /></div><p class="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Owners, administrators & staff</p><h2 class="mt-2 text-3xl font-semibold">Set up and run your organization</h2><p class="mt-3 max-w-lg leading-7 text-slate-600 dark:text-slate-300">From the first dojo to students, custom syllabi, grading readiness, multi-dojo exams, finance, permissions, and archived reports.</p><span class="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">Start organization guide <UIcon name="i-lucide-arrow-right" class="h-4 w-4 transition group-hover:translate-x-1" /></span></NuxtLink>
          <NuxtLink to="/help/students" class="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 dark:border-slate-800 dark:bg-slate-900"><div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600"><UIcon name="i-lucide-graduation-cap" class="h-6 w-6" /></div><p class="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">Students & families</p><h2 class="mt-2 text-3xl font-semibold">Use the student portal confidently</h2><p class="mt-3 max-w-lg leading-7 text-slate-600 dark:text-slate-300">Learn how access works, sign in, read your records, install the app, and get the right help.</p><span class="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-violet-600">Start student guide <UIcon name="i-lucide-arrow-right" class="h-4 w-4 transition group-hover:translate-x-1" /></span></NuxtLink>
        </section>

        <section class="mt-12 grid gap-4 sm:grid-cols-3">
          <NuxtLink v-for="card in resourceCards" :key="card.title" :to="card.to" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-primary/40 dark:border-slate-800 dark:bg-slate-900"><UIcon :name="card.icon" class="h-5 w-5 text-primary" /><h2 class="mt-4 text-xl font-semibold">{{ card.title }}</h2><p class="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{{ card.description }}</p></NuxtLink>
        </section>

        <section class="mt-14 rounded-3xl bg-slate-900 px-6 py-9 text-white sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-9 dark:bg-white dark:text-slate-950"><div><p class="text-sm font-semibold text-red-300 dark:text-red-700">STILL STUCK?</p><h2 class="mt-2 text-2xl font-semibold">Tell support what happened.</h2><p class="mt-2 max-w-2xl text-sm leading-6 text-slate-300 dark:text-slate-600">Include the page, approximate time, and expected result. Keep passwords and sensitive student information out of the message.</p></div><UButton to="/contact" size="lg" color="primary" class="mt-6 shrink-0 sm:mt-0">Contact support</UButton></section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { faqItems, glossaryItems, helpSlug, organizationSteps, studentSteps } from '~/utils/help-content'

definePageMeta({ layout: 'help' })
useSeoMeta({ title: 'Help Center | OpenDojos', description: 'Plain-language OpenDojos guides for organizations and students, plus frequently asked questions and a glossary.' })

const query = ref('')
const normalizedQuery = computed(() => query.value.trim().toLowerCase())
const searchIndex = [
  ...organizationSteps.map(step => ({ type: 'Organization guide', title: step.title, description: `${step.summary} ${step.details.join(' ')}`, to: `/help/organizations#${helpSlug(step.title)}` })),
  ...studentSteps.map(step => ({ type: 'Student guide', title: step.title, description: `${step.summary} ${step.details.join(' ')}`, to: `/help/students#${helpSlug(step.title)}` })),
  ...faqItems.map(item => ({ type: 'FAQ', title: item.question, description: item.answer, to: `/faq#${item.id}` })),
  ...glossaryItems.map(item => ({ type: 'Glossary', title: item.term, description: `${item.definition} ${item.example || ''}`, to: `/help/glossary#${helpSlug(item.term)}` }))
]
const results = computed(() => {
  const words = normalizedQuery.value.split(/\s+/).filter(Boolean)
  return searchIndex.filter(item => words.every(word => `${item.title} ${item.description} ${item.type}`.toLowerCase().includes(word))).slice(0, 24)
})
const resourceCards = [
  { title: 'Frequently asked questions', description: 'Quick answers about setup, access, payments, attendance, privacy, and student accounts.', icon: 'i-lucide-messages-square', to: '/faq' },
  { title: 'Plain-language glossary', description: 'Translate platform and martial-arts management terms without the jargon.', icon: 'i-lucide-book-open-text', to: '/help/glossary' },
  { title: 'Contact support', description: 'Learn what information to send so the team can investigate efficiently and safely.', icon: 'i-lucide-life-buoy', to: '/contact' }
]
</script>
