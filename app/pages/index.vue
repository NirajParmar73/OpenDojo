<template>
  <div v-if="!loggedIn" class="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
    <header class="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 sm:px-8"><div class="flex items-center gap-3"><span class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white">O</span><span><b>OpenDojo</b><span class="block text-xs text-slate-500 dark:text-slate-400">Dojo operations, unified</span></span></div><div class="flex items-center gap-3"><button class="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" :aria-label="colorMode.value === 'dark' ? 'Use light mode' : 'Use dark mode'" @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"><UIcon :name="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'" class="h-4 w-4" /></button><UButton to="/auth/login" color="neutral" variant="ghost">Sign in</UButton><UButton to="/onboarding">Start free</UButton></div></header>
    <main class="mx-auto max-w-7xl px-6 pb-20 pt-16 sm:px-8 sm:pt-24"><section class="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center"><div><p class="text-sm font-semibold text-primary">MULTI-TENANT DOJO MANAGEMENT</p><h1 class="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">Run every level of your martial-arts organization.</h1><p class="mt-6 max-w-xl text-lg leading-8 text-slate-600 dark:text-slate-300">OpenDojo brings hierarchy, students, instructors, classes, fees, expenses, affiliations, and reporting into one secure workspace.</p><div class="mt-8 flex flex-wrap gap-3"><UButton to="/onboarding" size="xl" icon="i-lucide-building-2">Create your organization</UButton><UButton to="/auth/login" size="xl" color="neutral" variant="outline">Sign in to workspace</UButton></div></div><div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-white/5 dark:shadow-2xl"><p class="text-sm font-semibold text-primary">ONE CONNECTED WORKSPACE</p><div class="mt-5 space-y-4"><div v-for="item in landingFeatures" :key="item.title" class="rounded-2xl bg-slate-100 p-4 dark:bg-slate-900"><UIcon :name="item.icon" class="h-5 w-5 text-primary" /><p class="mt-3 font-medium">{{ item.title }}</p><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ item.description }}</p></div></div></div></section></main>
  </div>
  <div v-else class="mx-auto max-w-7xl">
    <section class="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8 sm:py-10">
      <div class="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-500/30 blur-3xl" />
      <div class="relative">
        <p class="text-sm font-semibold text-violet-200">
          {{ dashboard?.scope || 'YOUR WORKSPACE' }}
        </p>
        <h2 class="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Your dojo at a glance.
        </h2>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
          A live view of the dojos, people, and instructors within the area you manage.
        </p>
      </div>
    </section>

    <section class="mt-8">
      <div
        v-if="pending"
        class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <USkeleton
          v-for="index in 4"
          :key="index"
          class="h-32 rounded-2xl"
        />
      </div>
      <UAlert
        v-else-if="error"
        color="error"
        title="Could not load dashboard"
        description="Please refresh the page and try again."
      />
      <template v-else>
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div
            v-for="stat in stats"
            :key="stat.label"
            class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium text-slate-500 dark:text-slate-400">
                {{ stat.label }}
              </p>
              <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UIcon
                  :name="stat.icon"
                  class="h-5 w-5"
                />
              </div>
            </div>
            <p class="mt-5 text-3xl font-semibold tracking-tight">
              {{ stat.value }}
            </p>
          </div>
        </div>

        <section class="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div class="border-b border-slate-100 p-6 dark:border-slate-800">
            <p class="text-sm font-semibold text-primary">
              HIERARCHY ANALYTICS
            </p>
            <h3 class="mt-1 text-lg font-semibold">
              Dojos and students by {{ dashboard?.hierarchyBreakdown?.label || 'area' }}
            </h3>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Counts reflect only the territory assigned to your account.
            </p>
          </div>
          <div
            v-if="dashboard?.hierarchyBreakdown?.items?.length"
            class="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-slate-800"
          >
            <div
              v-for="item in dashboard?.hierarchyBreakdown?.items || []"
              :key="item.id"
              class="flex items-center justify-between gap-4 p-5"
            >
              <div>
                <p class="font-medium">{{ item.name }}</p>
                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ item.dojos }} {{ item.dojos === 1 ? 'dojo' : 'dojos' }}</p>
              </div>
              <div class="text-right">
                <p class="text-2xl font-semibold tracking-tight">{{ item.students }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">students</p>
              </div>
            </div>
          </div>
          <div v-else class="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No hierarchy data is available in your current scope.
          </div>
        </section>

        <section class="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div class="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
            <div>
              <p class="text-sm font-semibold text-primary">
                DOJOS
              </p><h3 class="mt-1 text-lg font-semibold">
                Dojos in your scope
              </h3>
            </div>
            <UButton
              to="/dojos"
              color="primary"
              variant="soft"
              icon="i-lucide-building-2"
            >
              Manage dojos
            </UButton>
          </div>
          <div
            v-if="dashboard?.dojos.length"
            class="divide-y divide-slate-100 dark:divide-slate-800"
          >
            <div
              v-for="dojo in dashboard.dojos"
              :key="dojo.id"
              class="flex items-center justify-between gap-4 px-6 py-4"
            >
              <div>
                <p class="font-medium">
                  {{ dojo.name }}
                </p><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {{ dojo.nodeName }}
                </p>
              </div>
              <div class="text-right">
                <p class="font-semibold">
                  {{ dojo.studentCount }}
                </p><p class="text-xs text-slate-500 dark:text-slate-400">
                  students
                </p>
              </div>
            </div>
          </div>
          <div
            v-else
            class="p-10 text-center text-sm text-slate-500 dark:text-slate-400"
          >
            No dojos are assigned to your current scope.
          </div>
        </section>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
type Dashboard = {
  scope: string
  totals: { dojos: number, students: number, staff: number, instructors: number }
  hierarchyBreakdown: { label: string, items: Array<{ id: number, name: string, dojos: number, students: number }> }
  dojos: Array<{ id: number, name: string, nodeName: string, studentCount: number }>
}
const { loggedIn } = useUserSession()
const colorMode = useColorMode()
const { data: dashboard, pending, error, refresh } = await useFetch<Dashboard>('/api/dashboard', { immediate: false })
if (loggedIn.value) await refresh()
const landingFeatures = [{ title: 'Hierarchy-aware operations', description: 'Every user sees only their state, district, city, or dojo territory.', icon: 'i-lucide-network' }, { title: 'Students to progress reports', description: 'Track attendance, belts, fees, documents, and shareable progress.', icon: 'i-lucide-file-badge' }, { title: 'Financial control', description: 'Manage collections, expenses, affiliations, and net revenue.', icon: 'i-lucide-chart-no-axes-combined' }]
const stats = computed(() => [
  { label: 'Dojos', value: dashboard.value?.totals.dojos || 0, icon: 'i-lucide-building-2' },
  { label: 'Students', value: dashboard.value?.totals.students || 0, icon: 'i-lucide-users-round' },
  { label: 'Staff', value: dashboard.value?.totals.staff || 0, icon: 'i-lucide-user-cog' },
  { label: 'Instructors', value: dashboard.value?.totals.instructors || 0, icon: 'i-lucide-graduation-cap' }
])
</script>
