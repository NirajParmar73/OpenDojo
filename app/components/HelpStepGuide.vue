<template>
  <div class="space-y-5">
    <article v-for="(step, index) in steps" :id="helpSlug(step.title)" :key="step.title" class="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
      <div class="flex items-start gap-4">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{{ index + 1 }}</span>
        <div class="min-w-0 flex-1">
          <a :href="`#${helpSlug(step.title)}`" class="group inline-flex items-center gap-2"><h2 class="text-2xl font-semibold">{{ step.title }}</h2><UIcon name="i-lucide-link" class="h-4 w-4 text-slate-300 opacity-0 transition group-hover:opacity-100" /></a>
          <p class="mt-2 leading-7 text-slate-600 dark:text-slate-300">{{ step.summary }}</p>
          <ol class="mt-5 space-y-3">
            <li v-for="(detail, detailIndex) in step.details" :key="detail" class="flex gap-3 text-sm leading-6 text-slate-600 dark:text-slate-300"><span class="mt-0.5 font-semibold text-primary">{{ detailIndex + 1 }}.</span><span>{{ detail }}</span></li>
          </ol>
          <div v-if="step.tip" class="mt-5 flex gap-3 rounded-2xl bg-primary/8 p-4 text-sm leading-6 text-slate-700 dark:text-slate-200"><UIcon name="i-lucide-lightbulb" class="mt-1 h-4 w-4 shrink-0 text-primary" /><p><strong>In simple language:</strong> {{ step.tip }}</p></div>
        </div>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import type { HelpStep } from '~/utils/help-content'
import { helpSlug } from '~/utils/help-content'

defineProps<{ steps: HelpStep[] }>()
</script>
