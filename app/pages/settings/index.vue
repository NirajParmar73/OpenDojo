<template>
  <div class="mx-auto max-w-6xl">
    <section class="mb-8 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-6 dark:border-violet-950 dark:from-violet-950/40 dark:via-slate-900 dark:to-indigo-950/30 sm:p-8">
      <p class="mb-2 text-sm font-semibold text-primary">Organization</p>
      <h2 class="text-2xl font-semibold tracking-tight sm:text-3xl">Set up your dojo your way</h2>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
        Manage your organization identity, hierarchy, belt system, and fee plans from one place.
      </p>
    </section>

    <div class="grid gap-4 sm:grid-cols-2">
      <NuxtLink
        v-for="item in settingsItems"
        :key="item.to"
        :to="item.to"
        class="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UIcon :name="item.icon" class="h-5 w-5" />
        </div>
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="font-semibold">{{ item.title }}</h3>
            <p class="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{{ item.description }}</p>
          </div>
          <UIcon name="i-lucide-arrow-up-right" class="h-5 w-5 text-slate-400 transition group-hover:text-primary" />
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'] })

const settingsItems = [
  { title: 'General settings', description: 'Organization name, logo, and currency.', to: '/settings/general', icon: 'i-lucide-landmark' },
  { title: 'Plan & billing', description: 'Review plan limits and request an upgrade.', to: '/settings/subscription', icon: 'i-lucide-credit-card' },
  { title: 'Upgrade setup', description: 'Safely expand your hierarchy after a plan upgrade.', to: '/settings/expand-structure', icon: 'i-lucide-git-branch' },
  { title: 'Hierarchy', description: 'Model regions, branches, and dojo structure.', to: '/settings/hierarchy/nodes', icon: 'i-lucide-network' },
  { title: 'Belt system', description: 'Manage ranks, colours, and progression.', to: '/settings/belts', icon: 'i-lucide-award' },
  { title: 'Martial arts & programs', description: 'Manage the disciplines and styles you teach.', to: '/settings/programs', icon: 'i-lucide-swords' },
  { title: 'Affiliations & memberships', description: 'Track governing bodies, memberships, and renewals.', to: '/settings/affiliations', icon: 'i-lucide-badge-check' },
  { title: 'Fee plans', description: 'Define recurring and one-time fee plans.', to: '/settings/finance/fee-plans', icon: 'i-lucide-wallet-cards' },
  { title: 'Audit log', description: 'Review important changes made across your organization.', to: '/settings/audit-log', icon: 'i-lucide-scroll-text' },
]
</script>
