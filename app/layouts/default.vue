<template>
  <template v-if="isPublicLanding"><slot /></template>
  <div v-else class="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
    <div
      v-if="mobileNavigationOpen"
      class="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
      @click="mobileNavigationOpen = false"
    />

    <aside
      class="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0"
      :class="mobileNavigationOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex h-20 items-center gap-3 border-b border-slate-200 px-5 dark:border-slate-800">
        <img
          v-if="orgLogo"
          :src="orgLogo"
          :alt="`${orgName} logo`"
          class="h-10 w-10 rounded-xl object-cover shadow-sm"
        >
        <div v-else class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white shadow-sm">
          {{ orgName.charAt(0) }}
        </div>
        <div class="min-w-0">
          <p class="truncate font-semibold tracking-tight">{{ orgName }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">Dojo operations</p>
        </div>
        <button class="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800" @click="mobileNavigationOpen = false">
          <UIcon name="i-lucide-x" class="h-5 w-5" />
          <span class="sr-only">Close navigation</span>
        </button>
      </div>

      <nav class="flex-1 overflow-y-auto px-3 py-5" aria-label="Main navigation">
        <div v-for="group in navigation" :key="group.label" class="mb-6 last:mb-0">
          <p class="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
            {{ group.label }}
          </p>
          <div class="space-y-1">
            <NuxtLink
              v-for="item in group.items"
              :key="item.to"
              :to="item.to"
              class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              active-class="!bg-primary/10 !text-primary dark:!bg-primary/15"
              @click="mobileNavigationOpen = false"
            >
              <UIcon :name="item.icon" class="h-5 w-5 text-slate-400 transition group-hover:text-primary" />
              {{ item.label }}
            </NuxtLink>
          </div>
        </div>
      </nav>

      <div class="border-t border-slate-200 p-3 dark:border-slate-800">
        <NuxtLink to="/profile" class="flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-100 dark:hover:bg-slate-800">
          <img v-if="user?.avatar" :src="user.avatar" alt="" class="h-9 w-9 rounded-full object-cover">
          <div v-else class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
            {{ user?.name?.charAt(0) || 'U' }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ user?.name }}</p>
            <p class="truncate text-xs text-slate-500 dark:text-slate-400" :title="identityLabel">{{ identityLabel }}</p>
          </div>
          <UIcon name="i-lucide-chevron-right" class="h-4 w-4 text-slate-400" />
        </NuxtLink>
        <button
          class="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-300 dark:hover:bg-red-950/30 dark:hover:text-red-300"
          @click="logout"
        >
          <UIcon name="i-lucide-log-out" class="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>

    <div class="min-h-screen lg:pl-72">
      <header class="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-slate-50/85 px-4 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/85 sm:px-6 lg:px-8">
        <div class="flex min-w-0 items-center gap-3">
          <button class="rounded-xl p-2 text-slate-600 hover:bg-white hover:shadow-sm lg:hidden dark:text-slate-300 dark:hover:bg-slate-900" @click="mobileNavigationOpen = true">
            <UIcon name="i-lucide-menu" class="h-5 w-5" />
            <span class="sr-only">Open navigation</span>
          </button>
          <div class="min-w-0">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ sectionLabel }}</p>
            <h1 class="truncate text-xl font-semibold tracking-tight sm:text-2xl">{{ pageTitle }}</h1>
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-3">
          <button
            class="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
            :aria-label="colorMode.value === 'dark' ? 'Use light mode' : 'Use dark mode'"
            @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"
          >
            <UIcon :name="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'" class="h-5 w-5" />
          </button>
          <NuxtLink to="/profile" class="hidden rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-primary sm:inline-flex dark:text-slate-300 dark:hover:bg-slate-900">
            Profile
          </NuxtLink>
          <button class="hidden rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-red-600 sm:inline-flex dark:text-slate-300 dark:hover:bg-slate-900" @click="logout">
            Sign out
          </button>
        </div>
      </header>

      <main class="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const { user, clear, loggedIn } = useUserSession()
const router = useRouter()
const route = useRoute()
const colorMode = useColorMode()
const mobileNavigationOpen = ref(false)
const publicPaths = new Set(['/', '/pricing', '/terms', '/privacy', '/refund-policy', '/contact'])
const isPublicLanding = computed(() => publicPaths.has(route.path) && !loggedIn.value)
const { data: profile, refresh: refreshProfile } = await useFetch<any>('/api/user/profile', { immediate: false })

if (loggedIn.value) await refreshProfile()
watch(loggedIn, async (isLoggedIn) => {
  if (isLoggedIn) await refreshProfile()
})

const orgName = computed(() => user.value?.organizationName || 'OpenDojo')
const orgLogo = computed(() => user.value?.organizationLogo || null)
const formatRole = (role: string) => role.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
const identityLabel = computed(() => {
  const accountRole = formatRole(user.value?.role || 'member')
  const responsibilities = (profile.value?.assignments || []).map((assignment: { role: string, scopeName: string }) => `${formatRole(assignment.role)} — ${assignment.scopeName}`)
  return responsibilities.length ? `${accountRole} · ${responsibilities.join(', ')}` : accountRole
})

const allNavigation = [
  { label: 'Workspace', items: [{ label: 'Dashboard', to: '/', icon: 'i-lucide-layout-dashboard' }] },
  { label: 'Account', items: [{ label: 'Your profile', to: '/profile', icon: 'i-lucide-user-round' }] },
  {
    label: 'People',
    items: [
      { label: 'Students', to: '/students', icon: 'i-lucide-users-round' },
      { label: 'Staff & access', to: '/users', icon: 'i-lucide-shield-check' },
      { label: 'Instructors', to: '/users/instructors', icon: 'i-lucide-graduation-cap' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Dojos & schedules', to: '/dojos', icon: 'i-lucide-building-2' },
      { label: 'Attendance', to: '/attendance', icon: 'i-lucide-calendar-check-2' },
      { label: 'Tournaments', to: '/tournaments', icon: 'i-lucide-trophy' },
      { label: 'Tournament results', to: '/tournament-results', icon: 'i-lucide-medal' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Record payment', to: '/fees', icon: 'i-lucide-circle-dollar-sign' },
      { label: 'Recent receipts', to: '/receipts', icon: 'i-lucide-receipt-text' },
      { label: 'Collections overview', to: '/finance', icon: 'i-lucide-chart-no-axes-combined' },
      { label: 'Pending fees', to: '/finance/pending-fees', icon: 'i-lucide-clock-alert' },
      { label: 'Expenses', to: '/finance/expenses', icon: 'i-lucide-receipt-indian-rupee' },
      { label: 'Fee plans', to: '/settings/finance/fee-plans', icon: 'i-lucide-wallet-cards' },
    ],
  },
  {
    label: 'Insights',
    items: [{ label: 'Reports', to: '/reports', icon: 'i-lucide-file-chart-column' }, { label: 'Student progress', to: '/reports/student-progress', icon: 'i-lucide-file-badge' }, { label: 'Attendance reports', to: '/reports/attendance', icon: 'i-lucide-chart-no-axes-column-increasing' }, { label: 'Tournament achievements', to: '/reports/tournaments', icon: 'i-lucide-trophy' }, { label: 'Certificates awarded', to: '/certificates', icon: 'i-lucide-file-badge-2' }, { label: 'Revenue & expenses', to: '/reports/finance', icon: 'i-lucide-chart-no-axes-combined' }],
  },
  {
    label: 'Organization',
    items: [
      { label: 'Getting started', to: '/getting-started', icon: 'i-lucide-list-checks' },
      { label: 'Settings', to: '/settings', icon: 'i-lucide-settings-2' },
      { label: 'Plan & billing', to: '/settings/subscription', icon: 'i-lucide-credit-card' },
      { label: 'Hierarchy', to: '/settings/hierarchy/nodes', icon: 'i-lucide-network' },
      { label: 'Belt system', to: '/settings/belts', icon: 'i-lucide-award' },
      { label: 'Martial arts & programs', to: '/settings/programs', icon: 'i-lucide-swords' },
      { label: 'Affiliations & memberships', to: '/settings/affiliations', icon: 'i-lucide-badge-check' },
      { label: 'Audit log', to: '/settings/audit-log', icon: 'i-lucide-scroll-text' },
    ],
  },
]
const navigation = computed(() => {
  // A platform-owner session is intentionally kept out of customer workspace
  // operations. Organization members retain the full dojo navigation below.
  const items = user.value?.isPlatformAdmin
    ? [
        { label: 'Platform', items: [{ label: 'Platform console', to: '/platform', icon: 'i-lucide-shield-check' }] },
        { label: 'Account', items: [{ label: 'Your profile', to: '/profile', icon: 'i-lucide-user-round' }] },
      ]
    : allNavigation
  return items.map(section => {
  if (section.label === 'Organization' && user.value?.role !== 'owner') return { ...section, items: section.items.filter(item => ['/settings/hierarchy/nodes', '/settings/affiliations', '/settings/audit-log'].includes(item.to)) }
  if (section.label === 'Insights' && !['owner', 'admin'].includes(user.value?.role || '')) return { ...section, items: section.items.filter(item => item.to !== '/certificates') }
  return section
  }).filter(section => section.items.length > 0)
})

const pageMeta: Record<string, { title: string, section: string }> = {
  '/platform': { title: 'Platform console', section: 'Platform' },
  '/': { title: 'Dashboard', section: 'Workspace' },
  '/profile': { title: 'Your profile', section: 'Account' },
  '/students': { title: 'Students', section: 'People' },
  '/users': { title: 'Staff & access', section: 'People' },
  '/users/instructors': { title: 'Instructors', section: 'People' },
  '/dojos': { title: 'Dojos & schedules', section: 'Operations' },
  '/getting-started': { title: 'Getting started', section: 'Organization' },
  '/attendance': { title: 'Attendance', section: 'Operations' },
  '/tournaments': { title: 'Tournament management', section: 'Operations' },
  '/reports/attendance': { title: 'Attendance reports', section: 'Insights' },
  '/reports': { title: 'Reports', section: 'Insights' },
  '/reports/finance': { title: 'Revenue & expense report', section: 'Insights' },
  '/reports/student-progress': { title: 'Student progress report', section: 'Insights' },
  '/reports/tournaments': { title: 'Tournament achievement reports', section: 'Insights' },
  '/certificates': { title: 'Certificates awarded', section: 'Insights' },
  '/settings': { title: 'Organization settings', section: 'Organization' },
  '/settings/subscription': { title: 'Plan & billing', section: 'Organization' },
  '/settings/finance/fee-plans': { title: 'Fee plans', section: 'Finance' },
  '/fees': { title: 'Record payment', section: 'Finance' },
  '/receipts': { title: 'Recent receipts', section: 'Finance' },
  '/finance': { title: 'Collections overview', section: 'Finance' },
  '/finance/pending-fees': { title: 'Pending fees', section: 'Finance' },
  '/finance/expenses': { title: 'Expenses', section: 'Finance' },
  '/settings/hierarchy/nodes': { title: 'Hierarchy', section: 'Organization' },
  '/settings/hierarchy/levels': { title: 'Hierarchy levels', section: 'Organization' },
  '/settings/belts': { title: 'Belt system', section: 'Organization' },
  '/settings/programs': { title: 'Martial arts & programs', section: 'Organization' },
  '/settings/affiliations': { title: 'Affiliations & memberships', section: 'Organization' },
  '/settings/audit-log': { title: 'Audit log', section: 'Organization' },
}

const currentPage = computed(() => {
  if (route.path.match(/^\/students\/[^/]+\/edit$/)) {
    return { title: 'Edit student', section: 'People' }
  }
  if (route.path.startsWith('/students/')) {
    return { title: 'Student profile', section: 'People' }
  }
  return pageMeta[route.path] || { title: 'OpenDojo', section: 'Workspace' }
})
const pageTitle = computed(() => currentPage.value.title)
const sectionLabel = computed(() => currentPage.value.section)

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  await router.push('/auth/login')
}
</script>
