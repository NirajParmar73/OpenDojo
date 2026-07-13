<template>
  <section>
    <div class="mx-auto max-w-2xl text-center"><p class="text-sm font-semibold text-primary">SIMPLE, TRANSPARENT PRICING</p><h1 class="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Pricing that grows with your dojo.</h1><p class="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">Start free, then upgrade when your organization needs more capacity. All paid plans are billed monthly in Indian rupees.</p></div>
    <div class="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="plan in plans" :key="plan.name" class="relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm dark:bg-slate-900" :class="plan.featured ? 'border-primary ring-2 ring-primary/15' : 'border-slate-200 dark:border-slate-800'">
        <span v-if="plan.featured" class="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">Most popular</span>
        <div><h2 class="text-xl font-semibold">{{ plan.name }}</h2><p class="mt-2 min-h-12 text-sm leading-6 text-slate-500 dark:text-slate-400">{{ plan.description }}</p><p class="mt-6 text-4xl font-semibold tracking-tight">{{ plan.price }}<span v-if="plan.period" class="text-base font-normal text-slate-500 dark:text-slate-400">{{ plan.period }}</span></p><p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ plan.limit }}</p></div>
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
  { name: 'Free', price: 'Free', limit: '1 dojo · up to 20 students', description: 'For small dojos getting organized.', features: ['1 dojo workspace', 'Student records and attendance', 'Basic fee tracking', 'Core reports'] },
  { name: 'Starter', price: '₹199', period: '/month', limit: 'Up to 100 students', description: 'For an established single-dojo operation.', features: ['Everything in Free', 'Up to 100 students', 'Fee plans and payment records', 'Student progress reports'] },
  { name: 'Growth', price: '₹399', period: '/month', limit: 'Up to 300 students', description: 'For growing schools with more members to manage.', featured: true, features: ['Everything in Starter', 'Up to 300 students', 'Detailed attendance and finance reports', 'Tournament achievement tracking'] },
  { name: 'Professional', price: '₹699', period: '/month', limit: 'Unlimited students', description: 'For busy dojos with a larger teaching team.', features: ['Everything in Growth', 'Unlimited students', 'Multiple instructors', 'Advanced operational reporting'] },
  { name: 'Enterprise', price: 'Custom', limit: 'Multiple branches and federation management', description: 'A tailored plan for organizations coordinating across locations.', features: ['Everything in Professional', 'Multiple branches', 'Federation and hierarchy management', 'Priority onboarding support'] },
]
</script>
