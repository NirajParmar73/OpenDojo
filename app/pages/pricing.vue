<template>
  <section>
    <div class="mx-auto max-w-2xl text-center">
      <p class="text-sm font-semibold text-primary">SIMPLE, TRANSPARENT PRICING</p>
      <h1 class="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Pricing that grows with your organization.</h1>
      <p class="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">Start free, then scale from your city to your state and beyond.</p>
      <p class="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary"><UIcon name="i-lucide-sparkles" class="h-4 w-4" />All paid plans include a 14-day free trial. No credit card required.</p>
      <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">Prices shown in {{ currency }}. Choose the currency that applies to your organization during setup.</p>
      <div class="mt-7 inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label="Billing period">
        <button class="rounded-lg px-4 py-2 text-sm font-medium transition" :class="billingPeriod === 'monthly' ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white' : 'text-slate-600 dark:text-slate-300'" @click="billingPeriod = 'monthly'">Monthly</button>
        <button class="rounded-lg px-4 py-2 text-sm font-medium transition" :class="billingPeriod === 'annual' ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white' : 'text-slate-600 dark:text-slate-300'" @click="billingPeriod = 'annual'">Yearly <span class="text-primary">Save 2 months</span></button>
      </div>
    </div>

    <div class="mx-auto mt-12 grid max-w-6xl gap-5 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="plan in plans" :key="plan.key" class="relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm dark:bg-slate-900" :class="plan.featured ? 'border-primary ring-2 ring-primary/15' : 'border-slate-200 dark:border-slate-800'">
        <span v-if="plan.featured" class="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">Most popular</span>
        <div>
          <h2 class="text-xl font-semibold">{{ plan.name }}</h2>
          <p class="mt-2 min-h-12 text-sm leading-6 text-slate-500 dark:text-slate-400">{{ plan.description }}</p>
          <p class="mt-6 text-4xl font-semibold tracking-tight">{{ priceFor(plan) }}<span v-if="plan.monthly" class="text-base font-normal text-slate-500 dark:text-slate-400">{{ billingPeriod === 'annual' ? '/year' : '/month' }}</span></p>
          <p v-if="plan.monthly && billingPeriod === 'annual'" class="mt-1 text-xs text-primary">Equivalent to {{ priceForAmount(plan.annual / 12) }}/month</p>
          <p class="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">{{ plan.limit }}</p>
        </div>
        <ul class="mt-7 flex-1 space-y-3 text-sm text-slate-600 dark:text-slate-300"><li v-for="feature in plan.features" :key="feature" class="flex gap-2"><UIcon name="i-lucide-check" class="mt-0.5 h-4 w-4 shrink-0 text-primary" />{{ feature }}</li></ul>
        <UButton class="mt-8 justify-center" :to="plan.key === 'free' ? '/onboarding' : trialHref(plan.key)" :color="plan.featured ? 'primary' : 'neutral'" :variant="plan.featured ? 'solid' : 'outline'">{{ plan.key === 'free' ? 'Start Free Forever' : 'Start 14-day free trial' }}</UButton>
      </article>
    </div>

    <div class="mx-auto mt-10 max-w-6xl rounded-2xl border border-slate-200 bg-slate-100 p-6 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"><p class="font-semibold text-slate-900 dark:text-white">A note about billing</p><p class="mt-2">Every paid plan begins with a 14-day free trial and does not require a credit card. You can also stay on Free Forever until you exceed its limits. Prices are shown in {{ currency }} and exclude applicable taxes unless stated at checkout. Monthly plans renew each month; yearly plans are billed annually and include two months free. See our <NuxtLink to="/refund-policy" class="text-primary hover:underline">Refund Policy</NuxtLink> for details.</p></div>
  </section>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'legal' })
useHead({ title: 'Pricing | OpenDojo', meta: [{ name: 'description', content: 'Monthly and yearly pricing for martial-arts organizations using OpenDojo.' }] })

const billingPeriod = ref<'monthly' | 'annual'>('annual')
const currency = ref<'INR' | 'USD'>('INR')
const plans = [
  { key: 'free', name: 'Free Forever', monthly: 0, annual: 0, limit: '1 dojo location · 1 owner/instructor · up to 25 students', description: 'Everything a new dojo needs to get started.', features: ['Attendance', 'Basic belt records', 'Basic reports'] },
  { key: 'city-starter', name: 'City Starter', monthly: 199, annual: 1990, limit: 'Up to 2 locations in the same city · 75 students per location', description: 'For a growing city-based dojo team.', features: ['Owner + staff access', 'Hierarchy', 'Attendance, fees, and grading'] },
  { key: 'city-pro', name: 'City Pro', monthly: 399, annual: 3990, limit: 'Unlimited locations, students, and staff in one city', description: 'Full management for a city-wide organization.', featured: true, features: ['Everything in City Starter', 'Unlimited city locations', 'Full city-level management'] },
  { key: 'state-pro', name: 'State Pro', monthly: 699, annual: 6990, limit: 'Unlimited locations and cities across one state', description: 'Centralize operations across your state.', features: ['Unlimited students', 'State hierarchy', 'Centralized management'] },
  { key: 'national', name: 'National', monthly: 1999, annual: 19990, limit: 'Unlimited states, cities, dojos, and students', description: 'For federations and organizations operating nationwide.', features: ['Complete hierarchy', 'Federation management', 'Nationwide management'] },
]

function priceForAmount(amountInr: number) {
  if (currency.value === 'USD') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amountInr / 100)
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amountInr)
}

function priceFor(plan: typeof plans[number]) {
  return priceForAmount(billingPeriod.value === 'annual' ? plan.annual : plan.monthly)
}

function trialHref(plan: string) {
  return { path: '/onboarding', query: { trialPlan: plan, billingPeriod: billingPeriod.value, currency: currency.value } }
}

onMounted(async () => {
  try {
    const result = await $fetch<{ currency: 'INR' | 'USD' | null }>('/api/pricing/currency')
    if (result.currency) {
      currency.value = result.currency
      return
    }
  } catch {
    // The browser time zone below provides a fallback when no geo header is available.
  }

  currency.value = ['Asia/Kolkata', 'Asia/Calcutta'].includes(Intl.DateTimeFormat().resolvedOptions().timeZone) ? 'INR' : 'USD'
})
</script>
