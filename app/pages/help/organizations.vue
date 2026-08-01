<template>
  <div class="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
    <div class="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside class="hidden lg:block"><div class="sticky top-24"><p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">On this page</p><nav class="mt-3 space-y-1" aria-label="Organization guide sections"><a v-for="(step, index) in organizationSteps" :key="step.title" :href="`#${helpSlug(step.title)}`" class="block rounded-lg px-3 py-2 text-sm leading-5 text-slate-600 hover:bg-white hover:text-primary dark:text-slate-300 dark:hover:bg-slate-900"><span class="mr-2 text-slate-400">{{ index + 1 }}</span>{{ step.title }}</a></nav></div></aside>
      <div>
        <nav class="text-sm text-slate-500" aria-label="Breadcrumb"><NuxtLink to="/help" class="hover:text-primary">Help Center</NuxtLink><span class="mx-2">/</span><span>Organizations</span></nav>
        <p class="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-primary">Getting started for organizations</p>
        <h1 class="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">From an empty workspace to everyday operations.</h1>
        <p class="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">A practical guide for owners, administrators, location managers, and instructors. Follow it in order for a new organization, or jump to the task you need.</p>
        <div class="mt-7 flex flex-wrap gap-3"><UButton to="/onboarding" size="lg" icon="i-lucide-building-2">Create an organization</UButton><UButton :to="staffSignInUrl" size="lg" color="neutral" variant="outline" external>Sign in to workspace</UButton></div>
        <div class="my-10 rounded-2xl border border-amber-300/50 bg-amber-50 p-5 text-sm leading-6 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100"><div class="flex gap-3"><UIcon name="i-lucide-shield-check" class="mt-1 h-5 w-5 shrink-0" /><p><strong>Before adding real people:</strong> decide who should manage records, use an email address each person controls, and collect only the student information your organization genuinely needs.</p></div></div>
        <HelpStepGuide :steps="organizationSteps" />
        <div class="mt-10 flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900"><div><h2 class="text-xl font-semibold">Need a definition or a quick answer?</h2><p class="mt-1 text-sm text-slate-500">Use the glossary for terminology or the FAQ for common situations.</p></div><div class="flex gap-2"><UButton to="/help/glossary" color="neutral" variant="outline">Glossary</UButton><UButton to="/faq">View FAQ</UButton></div></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { helpSlug, organizationSteps } from '~/utils/help-content'
definePageMeta({ layout: 'help' })
useSeoMeta({ title: 'Organization Getting Started Guide | OpenDojos', description: 'A step-by-step, plain-language guide to setting up and running an organization in OpenDojos.' })
const { staffSignInUrl } = useApplicationUrls()
</script>
