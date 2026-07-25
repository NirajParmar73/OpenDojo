<template>
  <section>
    <div class="mx-auto max-w-2xl text-center">
      <p class="text-sm font-semibold text-primary">SIMPLE, TRANSPARENT PRICING</p>
      <h1 class="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Pricing that grows with your organization.</h1>
      <p class="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">Start free, then scale when you need more locations and students.</p>
      <p class="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary"><UIcon name="i-lucide-sparkles" class="h-4 w-4" />All paid plans include a 14-day free trial. No credit card required.</p>
      <div class="mt-7 inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800"><button class="rounded-lg px-4 py-2 text-sm font-medium" :class="billingPeriod === 'monthly' ? 'bg-white shadow-sm dark:bg-slate-950' : ''" @click="billingPeriod = 'monthly'">Monthly</button><button class="rounded-lg px-4 py-2 text-sm font-medium" :class="billingPeriod === 'annual' ? 'bg-white shadow-sm dark:bg-slate-950' : ''" @click="billingPeriod = 'annual'">Yearly <span class="text-primary">Save 2 months</span></button></div>
    </div>
    <div class="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-3">
      <article v-for="plan in plans" :key="plan.key" class="relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm dark:bg-slate-900" :class="plan.featured ? 'border-primary ring-2 ring-primary/15' : 'border-slate-200 dark:border-slate-800'"><span v-if="plan.featured" class="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">Most popular</span><div><h2 class="text-xl font-semibold">{{ plan.name }}</h2><p class="mt-2 min-h-12 text-sm leading-6 text-slate-500">{{ plan.description }}</p><p class="mt-6 text-4xl font-semibold tracking-tight">{{ priceFor(plan) }}<span v-if="plan.monthly" class="text-base font-normal text-slate-500">{{ billingPeriod === 'annual' ? '/year' : '/month' }}</span></p><p class="mt-2 text-sm font-medium">{{ plan.limit }}</p></div><ul class="mt-7 flex-1 space-y-3 text-sm text-slate-600"><li v-for="feature in plan.features" :key="feature" class="flex gap-2"><UIcon name="i-lucide-check" class="mt-0.5 h-4 w-4 shrink-0 text-primary" />{{ feature }}</li></ul><UButton class="mt-8 justify-center" :to="plan.key === 'free' ? '/onboarding' : trialHref(plan.key)" :color="plan.featured ? 'primary' : 'neutral'" :variant="plan.featured ? 'solid' : 'outline'">{{ plan.key === 'free' ? 'Start free' : 'Start 14-day free trial' }}</UButton></article>
    </div>
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'legal' })
useHead({ title: 'Pricing | OpenDojos' })
const billingPeriod = ref<'monthly' | 'annual'>('monthly')
const plans = [
  { key: 'free', name: 'Free', monthly: 0, annual: 0, limit: '1 dojo location · up to 20 students', description: 'Everything a new dojo needs to get started.', features: ['Attendance', 'Fees and grading', 'Basic reports'] },
  { key: 'growth', name: 'Growth', monthly: 999, annual: 9990, limit: 'Up to 3 dojo locations · up to 150 students', description: 'For a growing school with multiple locations.', featured: true, features: ['Location-specific fees and schedules', 'Staff access', 'Organization-wide reporting'] },
  { key: 'business', name: 'Business', monthly: 3999, annual: 39990, limit: 'Unlimited dojo locations · unlimited students', description: 'For established multi-location organizations.', features: ['Everything in Growth', 'Optional location groups', 'Advanced permissions and reports'] },
]
function priceFor(plan: typeof plans[number]) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(billingPeriod.value === 'annual' ? plan.annual : plan.monthly) }
function trialHref(plan: string) { return { path: '/onboarding', query: { trialPlan: plan, billingPeriod: billingPeriod.value } } }
</script>
