<template>
  <div class="mx-auto max-w-4xl">
    <section class="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-white to-violet-50 p-6 dark:via-slate-900 dark:to-violet-950/30 sm:p-8">
      <p class="text-sm font-semibold text-primary">GETTING STARTED</p>
      <h1 class="mt-2 text-3xl font-semibold tracking-tight">{{ guideTitle }}</h1>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{{ guideDescription }}</p>
      <div class="mt-6"><div class="flex justify-between text-sm font-medium"><span>{{ completedSteps }} of {{ requiredSteps.length }} essential steps complete</span><span>{{ progress }}%</span></div><div class="mt-2 h-2 overflow-hidden rounded-full bg-white/70 dark:bg-slate-800"><div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${progress}%` }" /></div></div>
    </section>

    <UAlert v-if="showWelcome" class="mt-5" color="success" variant="subtle" icon="i-lucide-sparkles" title="Your workspace foundation is ready" description="We created your first dojo, program, tuition plan, and owner instructor assignment. Review them below, add or import students, then define the syllabus and readiness workflow your organization uses." />

    <section class="mt-7 space-y-3">
      <article v-for="(item, index) in steps" :key="item.key" class="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-primary/40 dark:border-slate-800 dark:bg-slate-900">
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" :class="item.done ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'"><UIcon v-if="item.done" name="i-lucide-check" class="h-4 w-4" /><span v-else>{{ index + 1 }}</span></span>
        <div class="min-w-0 flex-1">
          <NuxtLink :to="item.to" class="block"><span class="flex items-center gap-2 font-semibold">{{ item.title }}<UBadge v-if="item.optional" color="neutral" variant="subtle" size="xs">Optional</UBadge></span><span class="mt-1 block text-sm leading-5 text-slate-500 dark:text-slate-400">{{ item.description }}</span></NuxtLink>
          <UButton v-if="item.secondaryTo" class="mt-3" :to="item.secondaryTo" color="neutral" variant="outline" size="xs" :icon="item.secondaryIcon">{{ item.secondaryLabel }}</UButton>
        </div>
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
useHead({ title: 'Getting started | OpenDojos' })

const { user } = useUserSession()
const route = useRoute()
const { data: subscription } = await useFetch<any>('/api/organization/subscription')
const { data: profile } = await useFetch<{ assignments: { role: string, scopeName: string }[] }>('/api/user/profile')
const { data: dashboard } = await useFetch<{ totals: { dojos: number, students: number, staff: number, instructors: number } }>('/api/dashboard')
const { data: attendanceSummary } = await useFetch<{ total: number }>('/api/reports/attendance/summary')
const { data: programs } = await useFetch<any[]>('/api/organization/programs', { immediate: user.value?.role === 'owner' })
const { data: belts } = await useFetch<any>('/api/belt-ranks', { immediate: user.value?.role === 'owner' })
const { data: financeOverview } = await useFetch<{ paymentCount: number }>('/api/finance/overview', { immediate: user.value?.role === 'owner' })
const { data: gradingExams } = await useFetch<any[]>('/api/grading-exams', { immediate: user.value?.role === 'owner' })
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
const showWelcome = computed(() => isOwner.value && route.query.welcome === '1')
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
  { key: 'owner:review-dojo', title: 'Review your dojo details', description: 'Setup created your first location. Check its address and contact details before enrolling students.', to: '/dojos', done: false },
  { key: 'owner:fee-structure', title: 'Review your tuition plan', description: 'Setup created the default recurring tuition plan. Grading and miscellaneous charges are added separately while recording a payment.', to: '/settings/finance/fee-plans', done: false },
  { key: 'owner:confirm-instructor', title: 'Review the instructor assignment', description: 'You start as the primary instructor for the first dojo. Change or supplement that assignment if someone else will teach.', to: '/dojos', done: false },
  { key: 'owner:create-schedule', title: 'Create a class schedule', description: 'Add the class day and time students will attend.', to: '/dojos', done: !!dojoSetup.value?.hasSchedule },
  { key: 'owner:program', title: 'Review your first program', description: 'Confirm the program created during setup. Add another program only when students train in another discipline or service.', to: '/settings/programs', done: false },
  ...(['karate', 'taekwondo', 'judo', 'bjj', 'hapkido', 'aikido', 'kendo', 'iaido', 'tang_soo_do'].includes(programs.value?.[0]?.martialArt) ? [{ key: 'owner:belt-ranks', title: 'Review the starter belt ranks', description: 'Adjust the generated rank order only if your school uses a different progression.', to: '/settings/belts', done: false }] : []),
  ...((belts.value?.ranks?.length || belts.value?.length || 0) > 0 ? [{ key: 'owner:syllabus', title: 'Build and publish your belt syllabus', description: 'Add your own sections and requirements for each next belt. Use cumulative inheritance when candidates must retain earlier material.', to: '/settings/syllabus', done: false }] : []),
  { key: 'owner:first-student', title: 'Add or import your students', description: (dojos.value?.length || 0) ? 'Enrol one person manually, or move your existing list from Excel or Google Sheets using the guided CSV importer.' : 'Create a dojo first; students and clients cannot be enrolled without one.', to: (dojos.value?.length || 0) ? '/students' : '/dojos', secondaryTo: (dojos.value?.length || 0) ? '/students/import' : undefined, secondaryLabel: 'Import spreadsheet', secondaryIcon: 'i-lucide-file-spreadsheet', done: (subscription.value?.usage.students || 0) > 0 },
  { key: 'owner:first-payment', title: 'Record your first payment', description: 'Record tuition and add grading exam or miscellaneous charges inline when needed. Additional charges remain separate from the tuition balance.', to: '/fees', done: (financeOverview.value?.paymentCount || 0) > 0 },
  ...((financeOverview.value?.paymentCount || 0) > 0 ? [{ key: 'owner:first-receipt', title: 'Open your first receipt', description: 'Download the payment PDF and use Receipts for future refunds without changing the original payment record.', to: '/receipts', done: false }] : []),
  ...((belts.value?.ranks?.length || belts.value?.length || 0) > 0 ? [{ key: 'owner:first-grading', title: 'Review readiness and schedule a grading', description: 'Assess each student’s syllabus, then select eligible candidates from one or several dojos for their configured next belt. OpenDojos creates the dojo exams together and lets you confirm or withdraw candidates later.', to: '/promotion-eligibility', secondaryTo: '/grading-exams', secondaryLabel: 'Manage grading exams', secondaryIcon: 'i-lucide-award', done: (gradingExams.value?.length || 0) > 0, optional: true }] : []),
  { key: 'owner:archived-reports', title: 'Know where historical reports live', description: 'Archived students remain available from the Students status filter. Authorized owners, administrators, and scoped managers can open their profile and print progress, attendance, achievement, or fee reports.', to: '/students', done: false, optional: true },
  ...(['growth', 'business'].includes(plan.value) ? [
    { key: 'owner:add-staff', title: 'Invite another staff member', description: 'Assign instructors or local managers only when another person needs workspace access.', to: '/users', done: (users.value?.length || 0) > 1, optional: true },
    { key: 'owner:locations-staff', title: 'Add another location', description: 'Each dojo can keep its own fees, schedules, staff, and students.', to: '/dojos', done: (dojos.value?.length || 0) > 1, optional: true },
  ] : []),
  ...(plan.value === 'business' ? [{ key: 'owner:location-groups', title: 'Organize location groups', description: 'Use optional groups only when shared reporting or delegated management would help.', to: '/settings/hierarchy/nodes', done: (subscription.value?.usage.hierarchyNodes || 0) > (dojos.value?.length || 0), optional: true }] : []),
])
const headSteps = computed(() => [
  { key: 'head:review-territory', title: `Review ${hierarchyAssignment.value?.scopeName || 'your territory'}`, description: 'Check the locations and staff already assigned below your hierarchy boundary.', to: '/settings/hierarchy/nodes', done: false },
  { key: 'head:territory-activity', title: 'Review your territory activity', description: 'Use reports to monitor attendance and operations for the dojos you manage, including printable history for archived students within your scope.', to: '/reports', done: false },
  { key: 'head:syllabus', title: 'Review the syllabus for your territory', description: 'Create or publish local belt requirements only when your territory differs from the organization syllabus, then assess students within your scope.', to: '/settings/syllabus', done: false },
  { key: 'head:grading-readiness', title: 'Schedule eligible grading candidates', description: 'Select eligible students from one or several dojos in your territory. Exams are created per dojo and participation can be changed later.', to: '/promotion-eligibility', done: false },
  { key: 'head:local-staff', title: 'Assign local leaders and instructors', description: 'Add staff only within your territory when another person needs access.', to: '/users', done: (users.value || []).some(staff => staff.id !== user.value?.id), optional: true },
  { key: 'head:lower-locations', title: 'Add lower-level locations', description: 'Expand below your assigned area only when the organization adds another operating territory.', to: '/settings/hierarchy/nodes', done: hasLowerLevelLocation.value, optional: true },
])
const dojoSteps = computed(() => [
  { key: 'dojo:review-dojo', title: 'Review your assigned dojo', description: 'Confirm the dojo details and the staff who work there.', to: '/dojos', done: false },
  { key: 'dojo:confirm-instructors', title: 'Confirm instructors', description: 'Make sure each class has an instructor assigned to this dojo.', to: '/dojos', done: false },
  { key: 'dojo:create-schedules', title: 'Create class schedules', description: 'Add the days and times your students attend.', to: '/dojos', done: !!dojoSetup.value?.hasSchedule },
  { key: 'dojo:support-students', title: 'Add or import students', description: 'Add one student manually or use the guided CSV importer for an existing spreadsheet. Each row is checked against the dojos and programs you can access.', to: '/students', secondaryTo: '/students/import', secondaryLabel: 'Import spreadsheet', secondaryIcon: 'i-lucide-file-spreadsheet', done: (dashboard.value?.totals.students || 0) > 0 },
  { key: 'dojo:attendance', title: 'Record your first attendance', description: 'Create a class session and save attendance for its students.', to: '/attendance', done: (attendanceSummary.value?.total || 0) > 0 },
  { key: 'dojo:syllabus-readiness', title: 'Assess next-belt readiness', description: 'Review the published syllabus on each student profile, mark required items ready or not ready, and schedule only eligible candidates.', to: '/promotion-eligibility', done: false },
])
const instructorSteps = computed(() => [
  { key: 'instructor:teaching-dojos', title: 'Review your teaching dojos', description: 'Confirm the locations and classes where you are assigned to teach.', to: '/dojos', done: false },
  { key: 'instructor:students', title: 'Review your students', description: 'Open the student directory for your assigned dojos and check the records available to you.', to: '/students', done: false },
  { key: 'instructor:attendance', title: 'Take your first attendance', description: 'Create or open a class session and save attendance so student progress stays accurate.', to: '/attendance', done: (attendanceSummary.value?.total || 0) > 0 },
])
const memberSteps = computed(() => [
  { key: 'member:assigned-area', title: 'Review your assigned area', description: 'Your dashboard and lists show only the dojos and responsibilities assigned to you.', to: '/', done: true },
  { key: 'member:students', title: 'Work with students', description: 'Use the student directory to review the records available to your account.', to: '/students', done: false },
  { key: 'member:responsibilities', title: 'Check your responsibilities', description: 'Your profile lists the locations and roles currently assigned to you.', to: '/profile', done: true },
])
const automaticSteps = computed(() => guideKind.value === 'owner' ? ownerSteps.value : guideKind.value === 'head' ? headSteps.value : guideKind.value === 'dojo' ? dojoSteps.value : guideKind.value === 'instructor' ? instructorSteps.value : memberSteps.value)
const steps = computed(() => automaticSteps.value.map(step => ({
  ...step,
  optional: 'optional' in step ? step.optional === true : false,
  secondaryTo: 'secondaryTo' in step ? step.secondaryTo : undefined,
  secondaryLabel: 'secondaryLabel' in step ? step.secondaryLabel : undefined,
  secondaryIcon: 'secondaryIcon' in step ? step.secondaryIcon : undefined,
  manuallyCompleted: completedStepKeys.value.has(step.key),
  done: step.done || completedStepKeys.value.has(step.key),
})))
const requiredSteps = computed(() => steps.value.filter(step => !step.optional))
const completedSteps = computed(() => requiredSteps.value.filter(step => step.done).length)
const progress = computed(() => requiredSteps.value.length ? Math.round((completedSteps.value / requiredSteps.value.length) * 100) : 0)
async function setStepCompletion(stepKey: string, completed: boolean) {
  await $fetch('/api/getting-started/progress', { method: 'PUT', body: { stepKey, completed } })
  await refreshProgress()
}
const planLabel = computed(() => plan.value === 'business' ? 'Business' : plan.value === 'growth' ? 'Growth' : 'Free')
const paidGuidance = computed(() => plan.value === 'business' ? 'Add locations freely. Use optional location groups only when shared reporting or delegated management would help.' : 'Add up to three locations; each can have independent fees, schedules, staff, and students.')
</script>
