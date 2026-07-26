<template>
  <div class="mx-auto max-w-3xl">
    <section class="rounded-3xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
      <p class="text-sm font-semibold text-primary">ORGANIZATION SETUP</p>
      <h2 class="mt-2 text-3xl font-semibold">Add location groups only when useful</h2>
      <p class="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        Dojos work independently of geography. Existing students, staff, tuition plans, payments,
        schedules, attendance, and reports remain attached to their current dojo records.
      </p>
    </section>

    <UCard class="mt-6">
      <template #header>
        <h3 class="font-semibold">Your {{ planLabel }} workspace</h3>
      </template>
      <p class="text-sm text-slate-600 dark:text-slate-300">
        Create optional groups such as “North region” or “Franchise locations” only if they make
        permissions and reporting easier. No automatic migration is required.
      </p>
      <div class="mt-6 flex flex-wrap gap-3">
        <UButton to="/settings/hierarchy/nodes">Manage location groups</UButton>
        <UButton to="/dojos" color="neutral" variant="outline">Manage dojos</UButton>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'owner'] })
const { data: subscription } = await useFetch<{ plan: string }>('/api/organization/subscription')
const planLabel = computed(() => subscription.value?.plan === 'business' ? 'Business' : subscription.value?.plan === 'growth' ? 'Growth' : 'Free')
</script>
