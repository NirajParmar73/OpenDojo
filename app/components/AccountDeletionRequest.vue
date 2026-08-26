<template>
  <div>
    <UAlert
      color="warning"
      variant="subtle"
      title="What happens after you submit"
      description="OpenDojos will verify your identity and account ownership before deleting data. Records that must be retained for legal, financial, fraud-prevention, or safeguarding reasons may be kept only for the required period."
    />
    <form class="mt-5 grid gap-4 sm:grid-cols-2" @submit.prevent="submitRequest">
      <UFormField label="Your name" required><UInput v-model="form.name" autocomplete="name" required /></UFormField>
      <UFormField label="Email address" required><UInput v-model="form.email" type="email" autocomplete="email" required /></UFormField>
      <UFormField label="Account type" required>
        <USelect v-model="form.accountType" :items="accountTypes" required />
      </UFormField>
      <UFormField label="Organization / dojo"><UInput v-model="form.organization" /></UFormField>
      <UFormField label="Additional details" class="sm:col-span-2"><UTextarea v-model="form.details" :rows="3" maxlength="1000" placeholder="Username, workspace address, or anything else that helps us identify the account" /></UFormField>
      <input v-model="form.website" tabindex="-1" autocomplete="off" class="absolute -left-[9999px]" aria-hidden="true">
      <div class="sm:col-span-2">
        <UCheckbox v-model="confirmed" label="I understand that verified deletion is permanent and may remove access to records and documents." />
        <UButton class="mt-4" type="submit" color="error" icon="i-lucide-trash-2" :loading="submitting" :disabled="!confirmed">Request account deletion</UButton>
      </div>
    </form>
    <UAlert v-if="submitted" class="mt-5" color="success" title="Deletion request received" description="Support will contact you at the supplied email address after verifying ownership." />
    <UAlert v-else-if="errorMessage" class="mt-5" color="error" title="Could not submit the request" :description="errorMessage" />
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ name?: string, email?: string, organization?: string, accountType?: 'organization_owner' | 'staff' | 'student' }>(), {
  name: '',
  email: '',
  organization: '',
  accountType: 'student'
})
const accountTypes = [
  { label: 'Organization owner', value: 'organization_owner' },
  { label: 'Staff account', value: 'staff' },
  { label: 'Student portal account', value: 'student' }
]
const form = reactive({ name: props.name, email: props.email, organization: props.organization, accountType: props.accountType, details: '', website: '' })
const confirmed = ref(false)
const submitting = ref(false)
const submitted = ref(false)
const errorMessage = ref('')

watch(() => [props.name, props.email, props.organization, props.accountType] as const, ([name, email, organization, accountType]) => {
  if (!form.name) form.name = name
  if (!form.email) form.email = email
  if (!form.organization) form.organization = organization
  form.accountType = accountType
})

async function submitRequest() {
  if (!confirmed.value) return
  submitting.value = true
  submitted.value = false
  errorMessage.value = ''
  try {
    await $fetch('/api/account-deletion-requests', { method: 'POST', body: form })
    submitted.value = true
    form.details = ''
    confirmed.value = false
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Email support to request deletion.'
  } finally {
    submitting.value = false
  }
}
</script>
