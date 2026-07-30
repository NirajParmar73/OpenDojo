<template>
  <div class="mx-auto mt-10 max-w-md sm:mt-16">
    <UCard>
      <template #header>
        <div>
          <p class="text-xs font-semibold tracking-[0.18em] text-primary">SECURE YOUR ACCOUNT</p>
          <h1 class="mt-1 text-xl font-semibold">Choose a new password</h1>
          <p class="mt-1 text-sm text-slate-500">Replace the temporary password supplied by your dojo before continuing.</p>
        </div>
      </template>
      <form class="space-y-4" @submit.prevent="changePassword">
        <UFormField label="Temporary password"><UInput v-model="form.currentPassword" type="password" autocomplete="current-password" required /></UFormField>
        <UFormField label="New password"><UInput v-model="form.newPassword" type="password" autocomplete="new-password" :minlength="8" required /></UFormField>
        <UFormField label="Confirm new password"><UInput v-model="form.confirmPassword" type="password" autocomplete="new-password" :minlength="8" required /></UFormField>
        <UButton type="submit" class="w-full" :loading="saving">Save password and continue</UButton>
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'portal-auth', layout: 'portal' })
const toast = useToast()
const session = useUserSession()
const saving = ref(false)
const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })

async function changePassword() {
  if (form.newPassword !== form.confirmPassword) {
    toast.add({ color: 'warning', title: 'Passwords do not match' })
    return
  }
  saving.value = true
  try {
    await $fetch('/api/portal/password', { method: 'PUT', body: { currentPassword: form.currentPassword, newPassword: form.newPassword } })
    await session.fetch()
    await navigateTo('/portal')
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not change password', description: error.data?.statusMessage || error.message })
  } finally {
    saving.value = false
  }
}
</script>
