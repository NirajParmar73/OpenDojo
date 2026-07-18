<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <div>
      <p class="text-sm font-medium text-primary">
        Account
      </p>
      <h2 class="mt-1 text-2xl font-semibold tracking-tight">
        Your profile
      </h2>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Update your account details, profile image, and password.
      </p>
    </div>

    <UCard>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 class="font-semibold">Email verification</h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ profile?.emailVerifiedAt ? 'Your email address is verified.' : 'Verify your email address to protect your account and enable sensitive actions.' }}</p></div>
        <UBadge v-if="profile?.emailVerifiedAt" color="success" variant="subtle">Verified</UBadge>
        <UButton v-else :loading="resendingVerification" @click="resendVerification">Send verification email</UButton>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div>
          <h3 class="font-semibold">
            Profile picture
          </h3>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            JPG, PNG, GIF, WEBP, or SVG up to 5 MB.
          </p>
        </div>
      </template>

      <div class="flex flex-col gap-5 sm:flex-row sm:items-center">
        <img
          v-if="profile?.avatar"
          :src="profile.avatar"
          :alt="`${profile.name}'s avatar`"
          class="h-20 w-20 rounded-full object-cover"
        >
        <div
          v-else
          class="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary"
        >
          {{ initials }}
        </div>
        <div class="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <UInput
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            @change="onFileChange"
          />
          <UButton
            :disabled="!avatarFile"
            :loading="uploadingAvatar"
            icon="i-lucide-upload"
            @click="uploadAvatar"
          >
            Upload
          </UButton>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div>
          <h3 class="font-semibold">
            Access & responsibilities
          </h3>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Your access level and assigned areas of responsibility.
          </p>
        </div>
      </template>
      <div class="flex flex-wrap gap-2">
        <UBadge color="primary" variant="subtle" class="capitalize">
          {{ formatRole(profile?.role || 'member') }}
        </UBadge>
        <UBadge v-for="assignment in profile?.assignments" :key="`${assignment.role}-${assignment.scopeName}`" color="neutral" variant="subtle" class="capitalize">
          {{ formatRole(assignment.role) }} · {{ assignment.scopeName }}
        </UBadge>
        <p v-if="profile?.role === 'member' && !profile.assignments.length" class="text-sm text-slate-500 dark:text-slate-400">
          No responsibility has been added yet.
        </p>
      </div>
      <div v-if="user?.role === 'owner'" class="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
        <p class="text-sm text-slate-500 dark:text-slate-400">As organization owner, you can also assign operational responsibilities to yourself, such as State Head, District Head, Dojo Head, or Instructor.</p>
        <UButton :to="`/users/${user.id}/edit`" class="mt-3" size="sm" color="primary" variant="soft" icon="i-lucide-shield-check">Manage my responsibilities</UButton>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div>
          <h3 class="font-semibold">
            Personal details
          </h3>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Your name and email are used throughout OpenDojo.
          </p>
        </div>
      </template>

      <form
        class="grid gap-4 sm:grid-cols-2"
        @submit.prevent="saveProfile"
      >
        <UFormField
          label="Full name"
          required
        >
          <UInput
            v-model="profileForm.name"
            autocomplete="name"
          />
        </UFormField>
        <UFormField
          label="Email address"
          required
        >
          <UInput
            v-model="profileForm.email"
            type="email"
            autocomplete="email"
          />
        </UFormField>
        <UFormField
          label="Dan degree"
          class="sm:col-span-2"
        >
          <UInput
            v-model="profileForm.danDegree"
            placeholder="Optional"
          />
        </UFormField>
        <div class="flex justify-end sm:col-span-2">
          <UButton
            type="submit"
            :loading="savingProfile"
          >
            Save profile
          </UButton>
        </div>
      </form>
    </UCard>

    <UCard>
      <template #header>
        <div>
          <h3 class="font-semibold">
            Change password
          </h3>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Use at least 8 characters and do not reuse your current password.
          </p>
        </div>
      </template>

      <form
        class="grid gap-4 sm:grid-cols-2"
        @submit.prevent="changePassword"
      >
        <UFormField
          label="Current password"
          required
          class="sm:col-span-2"
        >
          <UInput
            v-model="passwordForm.currentPassword"
            type="password"
            autocomplete="current-password"
          />
        </UFormField>
        <UFormField
          label="New password"
          required
        >
          <UInput
            v-model="passwordForm.newPassword"
            type="password"
            autocomplete="new-password"
          />
        </UFormField>
        <UFormField
          label="Confirm new password"
          required
        >
          <UInput
            v-model="passwordForm.confirmPassword"
            type="password"
            autocomplete="new-password"
          />
        </UFormField>
        <div class="flex justify-end sm:col-span-2">
          <UButton
            type="submit"
            :loading="changingPassword"
          >
            Update password
          </UButton>
        </div>
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

type Profile = {
  name: string
  email: string
  emailVerifiedAt: string | null
  avatar: string | null
  danDegree: string | null
  role: string
  assignments: Array<{ role: string, scopeName: string }>
}

const toast = useToast()
const { user, fetch: refreshSession } = useUserSession()
const { data: profile, refresh: refreshProfile } = await useFetch<Profile>('/api/user/profile')
const avatarFile = ref<File | null>(null)
const uploadingAvatar = ref(false)
const savingProfile = ref(false)
const changingPassword = ref(false)
const profileForm = reactive({ name: '', email: '', danDegree: '' })
const resendingVerification = ref(false)
const passwordForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })

watch(profile, (value) => {
  if (value) {
    profileForm.name = value.name
    profileForm.email = value.email
    profileForm.danDegree = value.danDegree || ''
  }
}, { immediate: true })

const initials = computed(() => profile.value?.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'U')
function formatRole(role: string) { return role === 'member' ? 'Standard access' : role === 'admin' ? 'Organization administrator' : role === 'owner' ? 'Organization owner' : role.replaceAll('_', ' ') }
async function resendVerification() { resendingVerification.value = true; try { await $fetch('/api/auth/resend-verification', { method: 'POST' }); toast.add({ color: 'success', title: 'Verification email sent', description: 'Check your inbox and spam folder.' }) } catch (error: any) { toast.add({ color: 'error', title: 'Could not send verification email', description: error.data?.statusMessage || error.message }) } finally { resendingVerification.value = false } }

function messageFor(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: { statusMessage?: string } }).data
    if (data?.statusMessage) return data.statusMessage
  }
  return error instanceof Error ? error.message : fallback
}

function onFileChange(event: Event) {
  avatarFile.value = (event.target as HTMLInputElement).files?.item(0) || null
}

async function uploadAvatar() {
  if (!avatarFile.value) return
  uploadingAvatar.value = true
  try {
    const formData = new FormData()
    formData.append('avatar', avatarFile.value)
    await $fetch('/api/user/avatar', { method: 'POST', body: formData })
    avatarFile.value = null
    await Promise.all([refreshProfile(), refreshSession()])
    toast.add({ color: 'success', title: 'Profile picture updated' })
  } catch (error) {
    toast.add({ color: 'error', title: 'Could not upload profile picture', description: messageFor(error, 'Upload failed') })
  } finally {
    uploadingAvatar.value = false
  }
}

async function saveProfile() {
  savingProfile.value = true
  try {
    await $fetch('/api/user/profile', {
      method: 'PATCH',
      body: { name: profileForm.name, email: profileForm.email, danDegree: profileForm.danDegree || null }
    })
    await Promise.all([refreshProfile(), refreshSession()])
    toast.add({ color: 'success', title: 'Profile updated' })
  } catch (error) {
    toast.add({ color: 'error', title: 'Could not update profile', description: messageFor(error, 'Update failed') })
  } finally {
    savingProfile.value = false
  }
}

async function changePassword() {
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    toast.add({ color: 'warning', title: 'New passwords do not match' })
    return
  }
  changingPassword.value = true
  try {
    await $fetch('/api/user/password', {
      method: 'PUT',
      body: { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }
    })
    Object.assign(passwordForm, { currentPassword: '', newPassword: '', confirmPassword: '' })
    toast.add({ color: 'success', title: 'Password updated' })
  } catch (error) {
    toast.add({ color: 'error', title: 'Could not update password', description: messageFor(error, 'Password update failed') })
  } finally {
    changingPassword.value = false
  }
}
</script>
