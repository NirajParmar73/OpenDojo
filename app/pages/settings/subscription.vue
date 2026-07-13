<template>
  <div class="mx-auto max-w-6xl">
    <section class="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-white to-violet-50 p-6 dark:via-slate-900 dark:to-violet-950/30 sm:p-8">
      <p class="text-sm font-semibold text-primary">
        PLAN & BILLING
      </p>
      <div class="mt-2 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-2xl font-semibold tracking-tight sm:text-3xl">
            Your {{ planLabel(subscription?.plan) }} plan
          </h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Choose a plan when you need more space for students, instructors, branches, or federation management. We will confirm billing before changing your plan.
          </p>
        </div>
        <UButton
          v-if="subscription?.testPlanChanges && subscription.plan !== 'enterprise'"
          class="mr-2"
          color="warning"
          variant="soft"
          icon="i-lucide-flask-conical"
          :loading="activatingTestPlan"
          @click="activateEnterpriseForTesting"
        >
          Activate Enterprise for testing
        </UButton>
        <UButton
          :href="upgradeHref(nextRecommendedPlan)"
          icon="i-lucide-arrow-up-right"
          :disabled="!nextRecommendedPlan"
        >
          {{ nextRecommendedPlan ? `Upgrade to ${planLabel(nextRecommendedPlan)}` : 'You have the highest plan' }}
        </UButton>
      </div>
    </section>

    <section
      v-if="subscription"
      class="mt-6 grid gap-4 sm:grid-cols-3"
    >
      <div class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Students
        </p>
        <p class="mt-2 text-2xl font-semibold">
          {{ subscription.usage.students }} <span class="text-base font-normal text-slate-500">/ {{ limitLabel(subscription.limits.students) }}</span>
        </p>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Dojos / branches
        </p>
        <p class="mt-2 text-2xl font-semibold">
          {{ subscription.usage.dojos }} <span class="text-base font-normal text-slate-500">/ {{ limitLabel(subscription.limits.dojos) }}</span>
        </p>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Hierarchy management
        </p>
        <p class="mt-2 text-2xl font-semibold">
          {{ subscription.plan === 'enterprise' ? 'Included' : 'Enterprise' }}
        </p>
      </div>
    </section>

    <section class="mt-8">
      <div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-xl font-semibold">
            Upgrade options
          </h2><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Select a plan to send a ready-to-review upgrade request to support.
          </p>
        </div>
        <NuxtLink
          to="/pricing"
          class="text-sm font-medium text-primary hover:underline"
        >Compare public pricing</NuxtLink>
      </div>
      <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="plan in paidPlans"
          :key="plan.key"
          class="flex flex-col rounded-2xl border bg-white p-5 dark:bg-slate-900"
          :class="subscription?.plan === plan.key ? 'border-primary ring-1 ring-primary/30' : 'border-slate-200 dark:border-slate-800'"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="font-semibold">
                {{ plan.name }}
              </h3><p class="mt-1 text-2xl font-semibold">
                {{ plan.price }}<span
                  v-if="plan.price !== 'Custom'"
                  class="text-sm font-normal text-slate-500"
                >/month</span>
              </p>
            </div><UBadge
              v-if="subscription?.plan === plan.key"
              color="primary"
              variant="subtle"
            >
              Current plan
            </UBadge>
          </div>
          <p class="mt-4 min-h-10 text-sm leading-5 text-slate-500 dark:text-slate-400">
            {{ plan.summary }}
          </p>
          <ul class="mt-4 flex-1 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li
              v-for="feature in plan.features"
              :key="feature"
              class="flex gap-2"
            >
              <UIcon
                name="i-lucide-check"
                class="mt-0.5 h-4 w-4 shrink-0 text-primary"
              />{{ feature }}
            </li>
          </ul>
          <UButton
            class="mt-6 justify-center"
            :href="upgradeHref(plan.key)"
            :disabled="subscription?.plan === plan.key"
            :variant="plan.key === 'growth' ? 'solid' : 'outline'"
          >
            {{ subscription?.plan === plan.key ? 'Current plan' : plan.key === 'enterprise' ? 'Talk to us' : `Request ${plan.name}` }}
          </UButton>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'owner'] })

type PlanKey = 'free' | 'starter' | 'growth' | 'professional' | 'enterprise'
type Subscription = { plan: PlanKey, limits: { students: number | null, dojos: number | null }, usage: { students: number, dojos: number, hierarchyNodes: number }, testPlanChanges: boolean }

const { data: subscription, refresh } = await useFetch<Subscription>('/api/organization/subscription')
const { supportEmail } = useLegalContact()
const toast = useToast()
const activatingTestPlan = ref(false)

const paidPlans = [
  { key: 'starter' as const, name: 'Starter', price: '₹199', summary: 'For an established single-dojo operation.', features: ['Up to 100 students', 'Fee plans and payment records'] },
  { key: 'growth' as const, name: 'Growth', price: '₹399', summary: 'For a growing dojo with more members.', features: ['Up to 300 students', 'Detailed attendance and finance reports'] },
  { key: 'professional' as const, name: 'Professional', price: '₹699', summary: 'For a dojo with a larger teaching team.', features: ['Unlimited students', 'Multiple instructors'] },
  { key: 'enterprise' as const, name: 'Enterprise', price: 'Custom', summary: 'For organizations with multiple branches.', features: ['Multiple branches', 'Federation management'] }
]

const planOrder: PlanKey[] = ['free', 'starter', 'growth', 'professional', 'enterprise']
const nextRecommendedPlan = computed<PlanKey | null>(() => {
  const currentIndex = planOrder.indexOf(subscription.value?.plan || 'free')
  return planOrder[currentIndex + 1] || null
})

function planLabel(plan?: PlanKey | null) {
  return plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Free'
}

function limitLabel(limit: number | null) {
  return limit === null ? 'Unlimited' : limit
}

function upgradeHref(plan: PlanKey | null) {
  if (!plan) return undefined
  const subject = `OpenDojo plan upgrade request: ${planLabel(plan)}`
  const body = `Hello,\n\nI would like to upgrade my organization to the ${planLabel(plan)} plan. Please send me the next steps and billing details.\n\nThank you.`
  return `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

async function activateEnterpriseForTesting() {
  activatingTestPlan.value = true
  try {
    await $fetch('/api/organization/subscription/enterprise-test', { method: 'POST' })
    await refresh()
    toast.add({ title: 'Enterprise plan activated for testing', color: 'success' })
  } catch {
    toast.add({ title: 'Could not activate the test plan', color: 'error' })
  } finally {
    activatingTestPlan.value = false
  }
}
</script>
