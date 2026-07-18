<template>
  <div class="mx-auto max-w-4xl">
    <section class="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-white to-violet-50 p-6 dark:via-slate-900 dark:to-violet-950/30 sm:p-8">
      <p class="text-sm font-semibold text-primary">GETTING STARTED</p>
      <h1 class="mt-2 text-3xl font-semibold tracking-tight">{{ guideTitle }}</h1>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{{ guideDescription }}</p>
      <div class="mt-6"><div class="flex justify-between text-sm font-medium"><span>{{ completedSteps }} of {{ steps.length }} complete</span><span>{{ progress }}%</span></div><div class="mt-2 h-2 overflow-hidden rounded-full bg-white/70 dark:bg-slate-800"><div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${progress}%` }" /></div></div>
    </section>

    <section class="mt-7 space-y-3">
      <article v-for="(item, index) in steps" :key="item.key" class="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-primary/40 dark:border-slate-800 dark:bg-slate-900">
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" :class="item.done ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'"><UIcon v-if="item.done" name="i-lucide-check" class="h-4 w-4" /><span v-else>{{ index + 1 }}</span></span>
        <NuxtLink :to="item.to" class="min-w-0 flex-1"><span class="font-semibold">{{ item.title }}</span><span class="mt-1 block text-sm leading-5 text-slate-500 dark:text-slate-400">{{ item.description }}</span></NuxtLink>
        <button v-if="!item.done" type="button" class="mt-0.5 shrink-0 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5" @click="setStepCompletion(item.key, true)">Mark complete</button>
        <button v-else-if="item.manuallyCompleted" type="button" class="mt-0.5 shrink-0 text-xs text-slate-500 hover:text-primary" @click="setStepCompletion(item.key, false)">Mark incomplete</button>
        <UIcon name="i-lucide-chevron-right" class="mt-1 h-5 w-5 text-slate-400" />
      </article>
    </section>

    <section v-if="isOwner && isPaid" class="mt-7 rounded-2xl border border-primary/20 bg-primary/5 p-5 dark:bg-primary/10"><h2 class="font-semibold">Your {{ planLabel }} workspace</h2><p class="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{{ paidGuidance }}</p></section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useHead({ title: 'Getting started | OpenDojo' })

const { user } = useUserSession()
const { data: subscription } = await useFetch<any>('/api/organization/subscription')
const { data: profile } = await useFetch<{ assignments: { role: string, scopeName: string }[] }>('/api/user/profile')
const { data: programs } = await useFetch<any[]>('/api/organization/programs', { immediate: user.value?.role === 'owner' })
const { data: belts } = await useFetch<any>('/api/belt-ranks', { immediate: user.value?.role === 'owner' })
const { data: feePlans } = await useFetch<any[]>('/api/fee-plans', { immediate: user.value?.role === 'owner' })
const { data: users } = await useFetch<any[]>('/api/users')
const { data: dojos } = await useFetch<any[]>('/api/dojos')
const { data: nodes } = await useFetch<any[]>('/api/hierarchy/nodes')
const { data: permissions } = await useFetch<{ managedParentNodeIds: number[] }>('/api/users/me/permissions')
const { data: savedProgress, refresh: refreshProgress } = await useFetch<{ completedStepKeys: string[] }>('/api/getting-started/progress')
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
const isOwner = computed(() => user.value?.role === 'owner')
const hierarchyRoles = ['country_head', 'state_head', 'district_head', 'city_head', 'zone_head']
const hierarchyAssignment = computed(() => {
  const assignments = profile.value?.assignments || []
  return hierarchyRoles.map(role => assignments.find(assignment => assignment.role === role)).find(Boolean) || null
})
const isDojoHead = computed(() => (profile.value?.assignments || []).some(assignment => assignment.role === 'dojo_head'))
const isInstructor = computed(() => (profile.value?.assignments || []).some(assignment => assignment.role === 'instructor'))
const guideKind = computed(() => isOwner.value ? 'owner' : hierarchyAssignment.value ? 'head' : isDojoHead.value ? 'dojo' : isInstructor.value ? 'instructor' : 'member')
const completedStepKeys = computed(() => new Set(savedProgress.value?.completedStepKeys || []))
const flatNodes = computed(() => {
  const result: any[] = []
  const visit = (node: any) => {
    result.push(node)
    for (const child of node.children || []) visit(child)
  }
  for (const node of nodes.value || []) visit(node)
  return result
})
const hasLowerLevelLocation = computed(() => {
  const managedParentIds = new Set(permissions.value?.managedParentNodeIds || [])
  return flatNodes.value.some(node => node.parentId && managedParentIds.has(node.parentId))
})
const roleName = (role: string) => role.split('_').map(part => part[0]?.toUpperCase() + part.slice(1)).join(' ')
const guideTitle = computed(() => guideKind.value === 'owner' ? 'Your dojo is almost ready.' : guideKind.value === 'head' ? `Your ${roleName(hierarchyAssignment.value!.role)} guide` : guideKind.value === 'dojo' ? 'Your Dojo Head guide' : guideKind.value === 'instructor' ? 'Your Instructor guide' : 'Your workspace guide')
const guideDescription = computed(() => {
  if (guideKind.value === 'owner') return 'Follow these plain-language steps. Each opens the exact screen you need—no technical setup required.'
  if (guideKind.value === 'head') return `Focus on ${hierarchyAssignment.value?.scopeName || 'your assigned territory'}: build only below your boundary, assign local staff, and review local activity.`
  if (guideKind.value === 'dojo') return 'Keep your assigned dojo ready for students: confirm instructors, schedules, attendance, and fees.'
  if (guideKind.value === 'instructor') return 'Use this guide to prepare your classes, keep attendance accurate, and follow student progress in your assigned dojos.'
  return 'This guide shows the main areas available to your account. Your access is limited to the responsibilities assigned to you.'
})

const ownerSteps = computed(() => [
  { key: 'owner:review-dojo', title: 'Review your dojo', description: 'Check the location details created during setup before enrolling students.', to: '/dojos', done: (dojos.value?.length || 0) > 0 },
  { key: 'owner:fee-structure', title: 'Set up your fee structure', description: 'Create or confirm a fee plan that can be assigned to new students.', to: '/settings/finance/fee-plans', done: (feePlans.value?.length || 0) > 0 },
  { key: 'owner:confirm-instructor', title: 'Confirm your instructor', description: 'You are assigned to the first dojo. Add another instructor if someone else will teach.', to: '/dojos', done: !!dojoSetup.value?.hasInstructor },
  { key: 'owner:create-schedule', title: 'Create a class schedule', description: 'Add the class day and time students will attend.', to: '/dojos', done: !!dojoSetup.value?.hasSchedule },
  { key: 'owner:program', title: 'Check your martial-art program', description: 'Make sure the discipline and style match what you teach.', to: '/settings/programs', done: (programs.value?.length || 0) > 0 },
  ...(['karate', 'taekwondo', 'judo', 'bjj', 'hapkido', 'aikido', 'kendo', 'iaido', 'tang_soo_do'].includes(programs.value?.[0]?.martialArt) ? [{ key: 'owner:belt-ranks', title: 'Review belt ranks', description: 'Your starter belt system is ready. Adjust ranks only if your school uses a different order.', to: '/settings/belts', done: (belts.value?.ranks?.length || belts.value?.length || 0) > 0 }] : []),
  { key: 'owner:first-student', title: 'Add your first student', description: (dojos.value?.length || 0) ? 'Enrol the student in a dojo and assign their fee plan.' : 'Create a dojo first; students cannot be enrolled without one.', to: (dojos.value?.length || 0) ? '/students' : '/dojos', done: (subscription.value?.usage.students || 0) > 0 },
  ...(isPaid.value ? [{ key: 'owner:hierarchy', title: 'Review your hierarchy', description: 'Expand locations and assign staff at the appropriate level as your organization grows.', to: '/settings/hierarchy/nodes', done: (subscription.value?.usage.hierarchyNodes || 0) > 1 }, { key: 'owner:locations-staff', title: 'Add locations and staff', description: 'Grow your organization by adding branches and assigning your team.', to: '/users', done: (users.value?.length || 0) > 1 }] : []),
])
const headSteps = computed(() => [
  { key: 'head:review-territory', title: `Review ${hierarchyAssignment.value?.scopeName || 'your territory'}`, description: 'Check the locations and staff already assigned below your hierarchy boundary.', to: '/settings/hierarchy/nodes', done: !!hierarchyAssignment.value },
  { key: 'head:lower-locations', title: 'Add lower-level locations', description: 'Create lower locations only below your assigned area when the organization expands.', to: '/settings/hierarchy/nodes', done: hasLowerLevelLocation.value },
  { key: 'head:local-staff', title: 'Assign local leaders and instructors', description: 'Add staff only within your territory, using the responsibility appropriate for each location.', to: '/users', done: (users.value || []).some(staff => staff.id !== user.value?.id) },
  { key: 'head:territory-activity', title: 'Review your territory activity', description: 'Use reports to monitor attendance and operations for the dojos you manage.', to: '/reports', done: false },
])
const dojoSteps = computed(() => [
  { key: 'dojo:review-dojo', title: 'Review your assigned dojo', description: 'Confirm the dojo details and the staff who work there.', to: '/dojos', done: (dojos.value?.length || 0) > 0 },
  { key: 'dojo:confirm-instructors', title: 'Confirm instructors', description: 'Make sure each class has an instructor assigned to this dojo.', to: '/dojos', done: !!dojoSetup.value?.hasInstructor },
  { key: 'dojo:create-schedules', title: 'Create class schedules', description: 'Add the days and times your students attend.', to: '/dojos', done: !!dojoSetup.value?.hasSchedule },
  { key: 'dojo:support-students', title: 'Enrol and support students', description: 'Review students in your dojo and keep their records up to date.', to: '/students', done: false },
])
const instructorSteps = computed(() => [
  { key: 'instructor:teaching-dojos', title: 'Review your teaching dojos', description: 'Confirm the locations and classes where you are assigned to teach.', to: '/dojos', done: (dojos.value?.length || 0) > 0 },
  { key: 'instructor:attendance', title: 'Take attendance', description: 'Record attendance for your classes so student progress stays accurate.', to: '/attendance', done: false },
  { key: 'instructor:students', title: 'Review your students', description: 'Open student records in your assigned dojos to follow their progress.', to: '/students', done: false },
])
const memberSteps = computed(() => [
  { key: 'member:assigned-area', title: 'Review your assigned area', description: 'Your dashboard and lists show only the dojos and responsibilities assigned to you.', to: '/', done: true },
  { key: 'member:students', title: 'Work with students', description: 'Use the student directory to review the records available to your account.', to: '/students', done: false },
  { key: 'member:responsibilities', title: 'Check your responsibilities', description: 'Your profile lists the locations and roles currently assigned to you.', to: '/profile', done: true },
])
const automaticSteps = computed(() => guideKind.value === 'owner' ? ownerSteps.value : guideKind.value === 'head' ? headSteps.value : guideKind.value === 'dojo' ? dojoSteps.value : guideKind.value === 'instructor' ? instructorSteps.value : memberSteps.value)
const steps = computed(() => automaticSteps.value.map(step => ({
  ...step,
  manuallyCompleted: completedStepKeys.value.has(step.key),
  done: step.done || completedStepKeys.value.has(step.key),
})))
const completedSteps = computed(() => steps.value.filter(step => step.done).length)
const progress = computed(() => steps.value.length ? Math.round((completedSteps.value / steps.value.length) * 100) : 0)
async function setStepCompletion(stepKey: string, completed: boolean) {
  await $fetch('/api/getting-started/progress', { method: 'PUT', body: { stepKey, completed } })
  await refreshProgress()
}
const planLabel = computed(() => ({ 'city-starter': 'City Starter', 'city-pro': 'City Pro', 'state-pro': 'State Pro', national: 'National' }[plan.value] || 'Free Forever'))
const paidGuidance = computed(() => plan.value === 'state-pro' ? 'When you add branches, build your State, District, and City hierarchy first, then place each dojo beneath the right city.' : plan.value === 'national' ? 'Build your federation hierarchy first, then assign states, branches, and staff to the appropriate level.' : 'Add locations as you grow, then assign staff to the dojo where they teach.')
</script>
