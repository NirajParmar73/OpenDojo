<template>
  <div class="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
    <div class="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside class="hidden lg:block"><div class="sticky top-24"><p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">On this page</p><nav class="mt-3 space-y-1" aria-label="Student guide sections"><a v-for="(step, index) in studentSteps" :key="step.title" :href="`#${helpSlug(step.title)}`" class="block rounded-lg px-3 py-2 text-sm leading-5 text-slate-600 hover:bg-white hover:text-primary dark:text-slate-300 dark:hover:bg-slate-900"><span class="mr-2 text-slate-400">{{ index + 1 }}</span>{{ step.title }}</a></nav></div></aside>
      <div>
        <nav class="text-sm text-slate-500" aria-label="Breadcrumb"><NuxtLink to="/help" class="hover:text-primary">Help Center</NuxtLink><span class="mx-2">/</span><span>Students</span></nav>
        <p class="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-violet-600">Getting started for students</p>
        <h1 class="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Your training information, in one simple portal.</h1>
        <p class="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">Learn how your school gives you access, what the information means, and where to go when something is missing or incorrect.</p>
        <div class="mt-7"><UButton :to="studentPortalUrl" size="lg" color="primary" icon="i-lucide-log-in" external>Open student portal</UButton></div>
        <div class="my-10 rounded-2xl border border-violet-300/50 bg-violet-50 p-5 text-sm leading-6 text-violet-950 dark:border-violet-800/60 dark:bg-violet-950/30 dark:text-violet-100"><div class="flex gap-3"><UIcon name="i-lucide-info" class="mt-1 h-5 w-5 shrink-0" /><p><strong>Your school manages your access and official records.</strong> Contact the organization first for an incorrect email, missing attendance, payment, belt rank, or portal account.</p></div></div>
        <HelpStepGuide :steps="studentSteps" />
        <div class="mt-10 rounded-3xl bg-slate-900 p-7 text-white dark:bg-white dark:text-slate-950"><h2 class="text-2xl font-semibold">A simple rule for account safety</h2><p class="mt-3 leading-7 text-slate-300 dark:text-slate-600">Never share your password with an instructor, organization administrator, or OpenDojos support. They can help without knowing it.</p><UButton to="/faq#password-safety" class="mt-5" color="primary">Read account safety FAQ</UButton></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { helpSlug, studentSteps } from '~/utils/help-content'
definePageMeta({ layout: 'help' })
useSeoMeta({ title: 'Student Getting Started Guide | OpenDojos', description: 'A plain-language guide to accessing and using the OpenDojos student portal.' })
const { studentPortalUrl } = useApplicationUrls()
</script>
