<template>
  <div class="mx-auto max-w-4xl">
    <section class="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-white to-violet-50 p-6 dark:via-slate-900 dark:to-violet-950/30 sm:p-8">
      <p class="text-sm font-semibold text-primary">GETTING STARTED</p>
      <h1 class="mt-2 text-3xl font-semibold tracking-tight">Your dojo is almost ready.</h1>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Follow these plain-language steps. Each opens the exact screen you need—no technical setup required.</p>
      <div class="mt-6"><div class="flex justify-between text-sm font-medium"><span>{{ completedSteps }} of {{ steps.length }} complete</span><span>{{ progress }}%</span></div><div class="mt-2 h-2 overflow-hidden rounded-full bg-white/70 dark:bg-slate-800"><div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${progress}%` }" /></div></div>
    </section>

    <section class="mt-7 space-y-3">
      <NuxtLink v-for="(item, index) in steps" :key="item.title" :to="item.to" class="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-primary/40 dark:border-slate-800 dark:bg-slate-900">
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" :class="item.done ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'"><UIcon v-if="item.done" name="i-lucide-check" class="h-4 w-4" /><span v-else>{{ index + 1 }}</span></span>
        <span class="flex-1"><span class="font-semibold">{{ item.title }}</span><span class="mt-1 block text-sm leading-5 text-slate-500 dark:text-slate-400">{{ item.description }}</span></span><UIcon name="i-lucide-chevron-right" class="mt-1 h-5 w-5 text-slate-400" />
      </NuxtLink>
    </section>

    <section v-if="isPaid" class="mt-7 rounded-2xl border border-primary/20 bg-primary/5 p-5 dark:bg-primary/10"><h2 class="font-semibold">Your {{ planLabel }} workspace</h2><p class="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{{ paidGuidance }}</p></section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'owner'] })
useHead({ title: 'Getting started | OpenDojo' })
const { data: subscription } = await useFetch<any>('/api/organization/subscription')
const { data: programs } = await useFetch<any[]>('/api/organization/programs')
const { data: belts } = await useFetch<any>('/api/belt-ranks')
const { data: feePlans } = await useFetch<any[]>('/api/fee-plans')
const { data: users } = await useFetch<any[]>('/api/users')
const { data: dojos } = await useFetch<any[]>('/api/dojos')
const { data: dojoSetup } = await useAsyncData('getting-started-dojo-setup', async () => {
  const results = await Promise.all((dojos.value || []).map(async dojo => {
    const [schedules, instructors] = await Promise.all([
      $fetch<any[]>(`/api/dojos/${dojo.id}/schedules`).catch(() => []),
      $fetch<any[]>(`/api/dojos/${dojo.id}/instructors`).catch(() => []),
    ])
    return { hasSchedule: schedules.length > 0, hasInstructor: instructors.length > 0 }
  }))
  return { hasSchedule: results.some(result => result.hasSchedule), hasInstructor: results.some(result => result.hasInstructor) }
})
const plan = computed(() => subscription.value?.plan || 'free')
const isPaid = computed(() => plan.value !== 'free')
const hierarchyTitle = computed(() => plan.value === 'state-pro' ? 'Review your State hierarchy' : plan.value === 'national' ? 'Review your federation hierarchy' : 'Organize your city hierarchy')
const hierarchyDescription = computed(() => plan.value === 'state-pro' ? 'Your starter State and City structure is ready. Add districts or branches only when you need them.' : plan.value === 'national' ? 'Your Country, State, and City structure is ready. Expand it as you add regions and branches.' : 'Add your city and branch structure before adding additional dojo locations.')
const steps = computed(() => [
  { title: 'Review your dojo', description: 'Check the location details created during setup before enrolling students.', to: '/dojos', done: (dojos.value?.length || 0) > 0 },
  { title: 'Set up your fee structure', description: 'Create or confirm a fee plan that can be assigned to new students.', to: '/settings/finance/fee-plans', done: (feePlans.value?.length || 0) > 0 },
  { title: 'Confirm your instructor', description: 'You are assigned to the first dojo. Add another instructor if someone else will teach.', to: '/dojos', done: !!dojoSetup.value?.hasInstructor },
  { title: 'Create a class schedule', description: 'Add the class day and time students will attend.', to: '/dojos', done: !!dojoSetup.value?.hasSchedule },
  { title: 'Check your martial-art program', description: 'Make sure the discipline and style match what you teach.', to: '/settings/programs', done: (programs.value?.length || 0) > 0 },
  ...(['karate', 'taekwondo', 'judo', 'bjj', 'hapkido', 'aikido', 'kendo', 'iaido', 'tang_soo_do'].includes(programs.value?.[0]?.martialArt) ? [{ title: 'Review belt ranks', description: 'Your starter belt system is ready. Adjust ranks only if your school uses a different order.', to: '/settings/belts', done: (belts.value?.ranks?.length || belts.value?.length || 0) > 0 }] : []),
  { title: 'Add your first student', description: (dojos.value?.length || 0) ? 'Enrol the student in a dojo and assign their fee plan.' : 'Create a dojo first; students cannot be enrolled without one.', to: (dojos.value?.length || 0) ? '/students' : '/dojos', done: (subscription.value?.usage.students || 0) > 0 },
  ...(isPaid.value ? [{ title: hierarchyTitle.value, description: hierarchyDescription.value, to: '/settings/hierarchy/nodes', done: (subscription.value?.usage.hierarchyNodes || 0) > 1 }, { title: 'Add locations and staff', description: 'Grow your organization by adding branches and assigning your team.', to: '/dojos', done: (users.value?.length || 0) > 1 }] : []),
])
const completedSteps = computed(() => steps.value.filter(step => step.done).length)
const progress = computed(() => steps.value.length ? Math.round((completedSteps.value / steps.value.length) * 100) : 0)
const planLabel = computed(() => ({ 'city-starter': 'City Starter', 'city-pro': 'City Pro', 'state-pro': 'State Pro', national: 'National' }[plan.value] || 'Free Forever'))
const paidGuidance = computed(() => plan.value === 'state-pro' ? 'When you add branches, build your State, District, and City hierarchy first, then place each dojo beneath the right city.' : plan.value === 'national' ? 'Build your federation hierarchy first, then assign states, branches, and staff to the appropriate level.' : 'Add locations as you grow, then assign staff to the dojo where they teach.')
</script>
