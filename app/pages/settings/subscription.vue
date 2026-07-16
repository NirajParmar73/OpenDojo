<template>
  <div class="mx-auto max-w-6xl">
    <section class="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-white to-violet-50 p-6 dark:via-slate-900 dark:to-violet-950/30 sm:p-8">
      <p class="text-sm font-semibold text-primary">PLAN & BILLING</p>
      <div class="mt-2 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><h2 class="text-2xl font-semibold tracking-tight sm:text-3xl">Your {{ planLabel(subscription?.plan) }} plan</h2><p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Choose a plan when you need more locations, students, staff, or broader management. We will confirm billing before changing your plan.</p></div><UButton :href="upgradeHref(nextRecommendedPlan)" icon="i-lucide-arrow-up-right" :disabled="!nextRecommendedPlan">{{ nextRecommendedPlan ? `Upgrade to ${planLabel(nextRecommendedPlan)}` : 'You have the highest plan' }}</UButton></div>
    </section>

    <section v-if="subscription" class="mt-6 grid gap-4 sm:grid-cols-3">
      <div v-for="item in usageCards" :key="item.label" class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p class="text-sm text-slate-500 dark:text-slate-400">{{ item.label }}</p><p class="mt-2 text-2xl font-semibold">{{ item.value }} <span v-if="item.limit" class="text-base font-normal text-slate-500">/ {{ item.limit }}</span></p></div>
    </section>

    <section class="mt-8">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 class="text-xl font-semibold">Upgrade options</h2><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Every paid plan starts with a 14-day free trial—no credit card required.</p></div><div class="flex items-center gap-4"><div class="inline-flex rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800"><button class="rounded-md px-3 py-1.5" :class="billingPeriod === 'monthly' ? 'bg-white shadow-sm dark:bg-slate-950' : ''" @click="billingPeriod = 'monthly'">Monthly</button><button class="rounded-md px-3 py-1.5" :class="billingPeriod === 'annual' ? 'bg-white shadow-sm dark:bg-slate-950' : ''" @click="billingPeriod = 'annual'">Yearly</button></div><NuxtLink to="/pricing" class="text-sm font-medium text-primary hover:underline">Compare pricing</NuxtLink></div></div>
      <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><article v-for="plan in paidPlans" :key="plan.key" class="flex flex-col rounded-2xl border bg-white p-5 dark:bg-slate-900" :class="subscription?.plan === plan.key ? 'border-primary ring-1 ring-primary/30' : 'border-slate-200 dark:border-slate-800'"><div class="flex items-start justify-between gap-3"><div><h3 class="font-semibold">{{ plan.name }}</h3><p class="mt-1 text-2xl font-semibold">{{ priceFor(plan) }}<span class="text-sm font-normal text-slate-500">{{ billingPeriod === 'annual' ? '/year' : '/month' }}</span></p></div><UBadge v-if="subscription?.plan === plan.key" color="primary" variant="subtle">Current plan</UBadge></div><p class="mt-4 min-h-10 text-sm leading-5 text-slate-500 dark:text-slate-400">{{ plan.summary }}</p><ul class="mt-4 flex-1 space-y-2 text-sm text-slate-600 dark:text-slate-300"><li v-for="feature in plan.features" :key="feature" class="flex gap-2"><UIcon name="i-lucide-check" class="mt-0.5 h-4 w-4 shrink-0 text-primary" />{{ feature }}</li></ul><UButton class="mt-6 justify-center" :loading="startingTrial === plan.key" :disabled="subscription?.plan === plan.key" :variant="plan.key === 'city-pro' ? 'solid' : 'outline'" @click="startTrial(plan.key)">{{ subscription?.plan === plan.key ? 'Current plan' : 'Start 14-day free trial' }}</UButton></article></div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'owner'] })
type PlanKey = 'free' | 'city-starter' | 'city-pro' | 'state-pro' | 'national'
type Subscription = { plan: PlanKey, limits: { students: number | null, dojos: number | null }, usage: { students: number, dojos: number, hierarchyNodes: number } }
const { data: subscription, refresh } = await useFetch<Subscription>('/api/organization/subscription')
const { supportEmail } = useLegalContact()
const toast = useToast()
const startingTrial = ref<PlanKey | null>(null)
const billingPeriod = ref<'monthly' | 'annual'>('annual')
const paidPlans = [
  { key: 'city-starter' as const, name: 'City Starter', monthly: 99, annual: 999, summary: 'For up to two locations in the same city.', features: ['75 students per location', 'Owner + staff, fees and grading'] },
  { key: 'city-pro' as const, name: 'City Pro', monthly: 249, annual: 2499, summary: 'For unlimited city-level management.', features: ['Unlimited locations, students, and staff', 'Full city-level management'] },
  { key: 'state-pro' as const, name: 'State Pro', monthly: 499, annual: 4999, summary: 'For operations across one state.', features: ['Unlimited cities and locations', 'Advanced reports'] },
  { key: 'national' as const, name: 'National', monthly: 999, annual: 9999, summary: 'For federations operating nationwide.', features: ['Federation management', 'AI reports and white-label options'] },
]
const planOrder: PlanKey[] = ['free', 'city-starter', 'city-pro', 'state-pro', 'national']
const nextRecommendedPlan = computed<PlanKey | null>(() => planOrder[planOrder.indexOf(subscription.value?.plan || 'free') + 1] || null)
const usageCards = computed(() => [
  { label: 'Students', value: subscription.value?.usage.students || 0, limit: limitLabel(subscription.value?.limits.students) },
  { label: 'Dojos / branches', value: subscription.value?.usage.dojos || 0, limit: limitLabel(subscription.value?.limits.dojos) },
  { label: 'Hierarchy management', value: subscription.value?.plan === 'national' ? 'Included' : 'National', limit: '' },
])
function planLabel(plan?: PlanKey | null) { return plan ? ({ free: 'Free Forever', 'city-starter': 'City Starter', 'city-pro': 'City Pro', 'state-pro': 'State Pro', national: 'National' }[plan]) : 'Free Forever' }
function limitLabel(limit?: number | null) { return limit === null || limit === undefined ? 'Unlimited' : String(limit) }
function priceFor(plan: typeof paidPlans[number]) { return `₹${(billingPeriod.value === 'annual' ? plan.annual : plan.monthly).toLocaleString('en-IN')}` }
function upgradeHref(plan: PlanKey | null) { if (!plan) return undefined; const subject = `OpenDojo 14-day trial: ${planLabel(plan)}`; const body = `Hello,\n\nI would like to start a 14-day, no-credit-card trial of the ${planLabel(plan)} plan on the ${billingPeriod.value} billing option.\n\nThank you.`; return `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` }
async function startTrial(plan: Exclude<PlanKey, 'free'>) { startingTrial.value = plan; try { await $fetch('/api/organization/subscription/trial', { method: 'POST', body: { plan, billingPeriod: billingPeriod.value } }); await refresh(); toast.add({ title: 'Your 14-day trial has started', color: 'success' }) } catch (error: any) { toast.add({ title: 'Could not start the trial', description: error.data?.statusMessage || error.message, color: 'error' }) } finally { startingTrial.value = null } }
</script>
