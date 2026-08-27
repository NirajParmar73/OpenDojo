<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <section><p class="text-sm font-semibold text-primary">STUDENT INTAKE</p><h2 class="mt-1 text-2xl font-semibold">Public student forms</h2><p class="mt-2 text-sm text-slate-500">Configure separate links for new admissions and existing students moving their membership into OpenDojos.</p></section>
    <UCard v-if="settings">
      <form class="space-y-5" @submit.prevent="save">
        <div><h3 class="text-lg font-semibold">New student admission</h3><p class="mt-1 text-sm text-slate-500">The existing admission workflow remains unchanged.</p></div>
        <UFormField label="Form title" required><UInput v-model="settings.title" class="w-full" required /></UFormField>
        <UFormField label="Introduction" required><UTextarea v-model="settings.introduction" class="w-full" :rows="3" required /></UFormField>
        <UFormField label="Physical-copy instructions" required><UTextarea v-model="settings.physicalCopyInstructions" class="w-full" :rows="3" required /></UFormField>
        <UFormField label="Privacy notice" required><UTextarea v-model="settings.privacyNotice" class="w-full" :rows="4" required /></UFormField>
        <UFormField label="Declaration and consent" required><UTextarea v-model="settings.consentText" class="w-full" :rows="4" required /></UFormField>
        <div class="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800"><UCheckbox v-model="settings.requirePhysicalCopy" label="Require staff to record the physical copy before approval" /><UCheckbox v-model="settings.isPublished" label="Publish the public admission form" /></div>
        <div v-if="settings.isPublished" class="rounded-xl bg-primary/5 p-4"><p class="text-xs font-semibold uppercase tracking-wide text-primary">Public admission link</p><div class="mt-2 flex gap-2"><UInput :model-value="publicUrl" readonly class="flex-1" /><UButton type="button" color="neutral" variant="outline" icon="i-lucide-copy" @click="copyLink">Copy</UButton><UButton type="button" :href="publicUrl" external icon="i-lucide-external-link">Open</UButton></div></div>
        <div class="border-t border-slate-200 pt-6 dark:border-slate-800"><h3 class="text-lg font-semibold">Existing student registration</h3><p class="mt-1 text-sm text-slate-500">Students fill this form without logging in. Their portal access remains disabled until a manager approves them.</p></div>
        <UFormField label="Form title" required><UInput v-model="settings.existingRegistrationTitle" class="w-full" required /></UFormField>
        <UFormField label="Introduction" required><UTextarea v-model="settings.existingRegistrationIntroduction" class="w-full" :rows="3" required /></UFormField>
        <UFormField label="Declaration and consent" required><UTextarea v-model="settings.existingRegistrationConsentText" class="w-full" :rows="4" required /></UFormField>
        <UCheckbox v-model="settings.isExistingRegistrationPublished" label="Publish the existing student registration form" />
        <div v-if="settings.isExistingRegistrationPublished" class="rounded-xl bg-emerald-500/5 p-4"><p class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Existing student registration link</p><div class="mt-2 flex gap-2"><UInput :model-value="existingRegistrationUrl" readonly class="flex-1" /><UButton type="button" color="neutral" variant="outline" icon="i-lucide-copy" @click="copyExistingLink">Copy</UButton><UButton type="button" :href="existingRegistrationUrl" external icon="i-lucide-external-link">Open</UButton></div></div>
        <div class="flex justify-end"><UButton type="submit" :loading="saving">Save public form settings</UButton></div>
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
const existingRegistrationUrl = computed(() => {
  const base = String(config.public.tenantBaseDomain || '').trim()
  return base ? `${requestUrl.protocol}//${settings.value?.organization?.slug}.${base}/existing-student-registration` : `${requestUrl.origin}/existing-student-registration?organization=${encodeURIComponent(settings.value?.organization?.slug || '')}`
})
async function copyLink() { await navigator.clipboard.writeText(publicUrl.value); toast.add({ color: 'success', title: 'Admission link copied' }) }
async function copyExistingLink() { await navigator.clipboard.writeText(existingRegistrationUrl.value); toast.add({ color: 'success', title: 'Existing student registration link copied' }) }
async function save() { saving.value = true; try { settings.value = { ...settings.value, ...await $fetch('/api/admissions/settings', { method: 'PUT', body: { title: settings.value.title, introduction: settings.value.introduction, physicalCopyInstructions: settings.value.physicalCopyInstructions, privacyNotice: settings.value.privacyNotice, consentText: settings.value.consentText, isPublished: settings.value.isPublished, requirePhysicalCopy: settings.value.requirePhysicalCopy, existingRegistrationTitle: settings.value.existingRegistrationTitle, existingRegistrationIntroduction: settings.value.existingRegistrationIntroduction, existingRegistrationConsentText: settings.value.existingRegistrationConsentText, isExistingRegistrationPublished: settings.value.isExistingRegistrationPublished } }) }; toast.add({ color: 'success', title: 'Public form settings saved' }) } catch (error: any) { toast.add({ color: 'error', title: 'Could not save settings', description: error.data?.statusMessage || error.message }) } finally { saving.value = false } }
</script>
