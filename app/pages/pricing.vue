<template>
  <section>
    <div class="mx-auto max-w-2xl text-center">
      <p class="text-sm font-semibold text-primary">SIMPLE, TRANSPARENT PRICING</p>
      <h1 class="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Pricing that grows with your dojo.</h1>
      <p class="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">Choose mainly by your student count, teaching team, and whether you run more than one location. All paid plans are billed monthly in Indian rupees.</p>
    </div>

    <section class="mx-auto mt-10 max-w-5xl rounded-3xl border border-primary/20 bg-primary/5 p-5 dark:bg-primary/10 sm:p-6">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 class="text-lg font-semibold">Not sure which plan to pick?</h2><p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Use this simple rule of thumb—upgrade only when one of these sounds like you.</p></div>
        <UIcon name="i-lucide-circle-help" class="hidden h-8 w-8 text-primary sm:block" />
      </div>
      <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="tip in decisionTips" :key="tip.title" class="rounded-2xl bg-white/80 p-4 dark:bg-slate-900/70"><p class="font-semibold">{{ tip.title }}</p><p class="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">{{ tip.text }}</p></div>
      </div>
    </section>

    <div class="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="plan in plans" :key="plan.name" class="relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm dark:bg-slate-900" :class="plan.featured ? 'border-primary ring-2 ring-primary/15' : 'border-slate-200 dark:border-slate-800'">
        <span v-if="plan.featured" class="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">Most popular</span>
        <div>
          <h2 class="text-xl font-semibold">{{ plan.name }}</h2><p class="mt-2 min-h-12 text-sm leading-6 text-slate-500 dark:text-slate-400">{{ plan.description }}</p>
          <div class="mt-4 rounded-xl bg-slate-100 p-3 dark:bg-slate-800/80"><p class="text-xs font-semibold uppercase tracking-wide text-primary">Best for</p><p class="mt-1 text-sm font-medium leading-5">{{ plan.bestFor }}</p><p class="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{{ plan.chooseWhen }}</p></div>
          <p class="mt-6 text-4xl font-semibold tracking-tight">{{ plan.price }}<span v-if="plan.period" class="text-base font-normal text-slate-500 dark:text-slate-400">{{ plan.period }}</span></p><p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ plan.limit }}</p>
        </div>
        <ul class="mt-7 flex-1 space-y-3 text-sm text-slate-600 dark:text-slate-300"><li v-for="feature in plan.features" :key="feature" class="flex gap-2"><UIcon name="i-lucide-check" class="mt-0.5 h-4 w-4 shrink-0 text-primary" />{{ feature }}</li></ul>
        <UButton class="mt-8 justify-center" :to="plan.name === 'Enterprise' ? '/contact' : '/onboarding'" :color="plan.featured ? 'primary' : 'neutral'" :variant="plan.featured ? 'solid' : 'outline'">{{ plan.name === 'Enterprise' ? 'Contact us' : plan.name === 'Free' ? 'Start free' : 'Choose plan' }}</UButton>
      </article>
    </div>

    <div class="mt-10 rounded-2xl border border-slate-200 bg-slate-100 p-6 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"><p class="font-semibold text-slate-900 dark:text-white">A note about billing</p><p class="mt-2">Prices are in INR and exclude applicable taxes unless stated at checkout. You can cancel at any time; cancellation takes effect at the end of the current billing period. See our <NuxtLink to="/refund-policy" class="text-primary hover:underline">Refund Policy</NuxtLink> for details.</p></div>
  </section>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'legal' })
useHead({ title: 'Pricing | OpenDojo', meta: [{ name: 'description', content: 'Simple monthly pricing for martial-arts organizations using OpenDojo.' }] })

const plans = [
  { name: 'Free', price: 'Free', limit: '1 dojo · up to 20 students · 1 instructor', description: 'A no-pressure way to put your first dojo records in one place.', bestFor: 'A new or very small dojo', chooseWhen: 'Choose this if you have 20 or fewer students and one instructor.', features: ['1 dojo workspace', 'Student records and attendance', 'Basic fee tracking', 'Core reports'] },
  { name: 'Starter', price: '₹199', period: '/month', limit: '1 dojo · up to 100 students · 1 instructor', description: 'More room for a single dojo that has found its rhythm.', bestFor: 'A solo instructor managing a regular class roster', chooseWhen: 'Choose this when you outgrow 20 students but still teach on your own.', features: ['Everything in Free', 'Up to 100 students', 'Fee plans and payment records', 'Student progress reports'] },
  { name: 'Growth', price: '₹399', period: '/month', limit: '1 dojo · up to 300 students · 1 instructor', description: 'Built for a busy single location with a large student community.', bestFor: 'A popular dojo with many students', chooseWhen: 'Choose this when your one dojo needs space for 101–300 students.', featured: true, features: ['Everything in Starter', 'Up to 300 students', 'Detailed attendance and finance reports', 'Tournament achievement tracking'] },
  { name: 'Professional', price: '₹699', period: '/month', limit: '1 dojo · unlimited students · multiple instructors', description: 'No student cap, plus support for a larger teaching team.', bestFor: 'A high-volume dojo with assistant instructors', chooseWhen: 'Choose this when you need more than one instructor or more than 300 students.', features: ['Everything in Growth', 'Unlimited students', 'Multiple instructors', 'Advanced operational reporting'] },
  { name: 'Enterprise', price: 'Custom', limit: 'Multiple dojos · unlimited students and instructors', description: 'A tailored workspace for organizations that coordinate across locations.', bestFor: 'A multi-branch academy, association, or federation', chooseWhen: 'Choose this if you operate more than one dojo or need hierarchy management.', features: ['Everything in Professional', 'Multiple branches', 'Federation and hierarchy management', 'Priority onboarding support'] },
]

const decisionTips = [
  { title: 'Just starting?', text: 'Pick Free for up to 20 students.' },
  { title: 'One dojo, up to 100?', text: 'Starter is the practical next step.' },
  { title: 'One busy dojo?', text: 'Growth covers up to 300 students.' },
  { title: 'Several teachers or branches?', text: 'Choose Professional for teachers, Enterprise for branches.' },
]
</script>
