<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <section><p class="text-sm font-semibold text-primary">ADMISSIONS</p><h2 class="mt-1 text-2xl font-semibold">Online admission form</h2><p class="mt-2 text-sm text-slate-500">Configure the public application, physical-copy instructions, and consent shown to applicants.</p></section>
    <UCard v-if="settings">
      <form class="space-y-5" @submit.prevent="save">
        <UFormField label="Form title" required><UInput v-model="settings.title" class="w-full" required /></UFormField>
        <UFormField label="Introduction" required><UTextarea v-model="settings.introduction" class="w-full" :rows="3" required /></UFormField>
        <UFormField label="Physical-copy instructions" required><UTextarea v-model="settings.physicalCopyInstructions" class="w-full" :rows="3" required /></UFormField>
        <UFormField label="Privacy notice" required><UTextarea v-model="settings.privacyNotice" class="w-full" :rows="4" required /></UFormField>
        <UFormField label="Declaration and consent" required><UTextarea v-model="settings.consentText" class="w-full" :rows="4" required /></UFormField>
        <div class="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800"><UCheckbox v-model="settings.requirePhysicalCopy" label="Require staff to record the physical copy before approval" /><UCheckbox v-model="settings.isPublished" label="Publish the public admission form" /></div>
        <div v-if="settings.isPublished" class="rounded-xl bg-primary/5 p-4"><p class="text-xs font-semibold uppercase tracking-wide text-primary">Public admission link</p><div class="mt-2 flex gap-2"><UInput :model-value="publicUrl" readonly class="flex-1" /><UButton type="button" color="neutral" variant="outline" icon="i-lucide-copy" @click="copyLink">Copy</UButton><UButton type="button" :href="publicUrl" external icon="i-lucide-external-link">Open</UButton></div></div>
        <div class="flex justify-end"><UButton type="submit" :loading="saving">Save admission settings</UButton></div>
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'] })
const toast = useToast()
const config = useRuntimeConfig()
const requestUrl = useRequestURL()
const { data: settings } = await useFetch<any>('/api/admissions/settings')
const saving = ref(false)
const publicUrl = computed(() => {
  const base = String(config.public.tenantBaseDomain || '').trim()
  return base ? `${requestUrl.protocol}//${settings.value?.organization?.slug}.${base}/admissions` : `${requestUrl.origin}/admissions?organization=${encodeURIComponent(settings.value?.organization?.slug || '')}`
})
async function copyLink() { await navigator.clipboard.writeText(publicUrl.value); toast.add({ color: 'success', title: 'Admission link copied' }) }
async function save() { saving.value = true; try { settings.value = { ...settings.value, ...await $fetch('/api/admissions/settings', { method: 'PUT', body: { title: settings.value.title, introduction: settings.value.introduction, physicalCopyInstructions: settings.value.physicalCopyInstructions, privacyNotice: settings.value.privacyNotice, consentText: settings.value.consentText, isPublished: settings.value.isPublished, requirePhysicalCopy: settings.value.requirePhysicalCopy } }) }; toast.add({ color: 'success', title: 'Admission settings saved' }) } catch (error: any) { toast.add({ color: 'error', title: 'Could not save settings', description: error.data?.statusMessage || error.message }) } finally { saving.value = false } }
</script>

