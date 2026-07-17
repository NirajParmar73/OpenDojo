<template>
  <div class="mx-auto max-w-3xl">
    <section class="rounded-3xl border border-primary/20 bg-primary/5 p-6 sm:p-8"><p class="text-sm font-semibold text-primary">UPGRADE SETUP</p><h2 class="mt-2 text-3xl font-semibold">Expand your organization safely</h2><p class="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">This wizard only creates hierarchy records and places existing dojos into them. Students, staff, fees, payments, schedules, attendance, and reports stay attached to the same dojo records.</p></section>
    <UCard class="mt-6"><template #header><h3 class="font-semibold">Your {{ planLabel }} workspace</h3></template><template v-if="canExpand"><p class="text-sm text-slate-600 dark:text-slate-300">We will create: <strong>{{ structure }}</strong>.</p><p class="mt-3 text-sm text-slate-500">Each existing dojo will be placed under its city using its saved location details. You can refine branches and districts afterward.</p><UButton class="mt-6" :loading="applying" @click="apply">Create my hierarchy safely</UButton></template><p v-else class="text-sm text-slate-600 dark:text-slate-300">City and Free workspaces do not need a geographic hierarchy. Once you upgrade to State Pro or National, return here to set it up.</p></UCard>
  </div>
</template>
<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'owner'] })
const toast = useToast(); const router = useRouter(); const applying = ref(false)
const { data: subscription } = await useFetch<{ plan: string }>('/api/organization/subscription')
const canExpand = computed(() => ['state-pro', 'national'].includes(subscription.value?.plan || ''))
const planLabel = computed(() => subscription.value?.plan === 'national' ? 'National' : subscription.value?.plan === 'state-pro' ? 'State Pro' : subscription.value?.plan === 'city-pro' ? 'City Pro' : subscription.value?.plan === 'city-starter' ? 'City Starter' : 'Free Forever')
const structure = computed(() => subscription.value?.plan === 'national' ? 'Country → State / Province → City / Town → Branch → Dojo' : 'State / Province → City / Town → Branch → Dojo')
async function apply() { applying.value = true; try { const result = await $fetch<{ migrated: number }>('/api/organization/hierarchy/expand', { method: 'POST' }); toast.add({ color: 'success', title: 'Hierarchy is ready', description: `${result.migrated} dojo(s) were placed safely.` }); await router.push('/settings/hierarchy/nodes') } catch (error: any) { toast.add({ color: 'error', title: 'Could not expand your structure', description: error.data?.statusMessage || error.message }) } finally { applying.value = false } }
</script>
