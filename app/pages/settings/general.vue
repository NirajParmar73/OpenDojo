<template>
  <div class="max-w-2xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6">Organization Settings</h1>

    <form @submit.prevent="saveSettings" enctype="multipart/form-data">
      <div class="mb-4">
        <label class="block text-sm font-medium">Organization Name</label>
        <UInput v-model="form.name" class="w-full" required />
      </div>

      <div class="mb-4">
        <label class="block text-sm font-medium">Current Logo</label>
        <div class="flex items-center gap-4">
          <img v-if="org.logo" :src="org.logo" class="h-16 w-auto object-contain" />
          <div v-else class="h-16 w-16 bg-gray-200 rounded flex items-center justify-center text-gray-500">No logo</div>
        </div>
      </div>

      <div class="mb-4">
        <label class="block text-sm font-medium">Upload New Logo (optional)</label>
        <UInput type="file" accept="image/*" @change="onFileChange" />
      </div>

      <UButton type="submit" :loading="loading">Save Settings</UButton>
    </form>

    <p v-if="message" class="mt-4 text-green-600">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { user, fetch } = useUserSession()
const toast = useToast()
const loading = ref(false)
const message = ref('')

const org = reactive({
  name: '',
  logo: null as string | null,
})

const form = reactive({
  name: '',
})

const logoFile = ref<File | null>(null)

// Load current org data
onMounted(async () => {
  try {
    const data = await $fetch('/api/organization/settings')
    org.name = data.name
    org.logo = data.logo
    form.name = data.name
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Failed to load settings',
      description: error.data?.statusMessage || error.message,
    })
  }
})

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  logoFile.value = target.files?.[0] ?? null
}

async function saveSettings() {
  loading.value = true
  message.value = ''
  try {
    const fd = new FormData()
    fd.append('name', form.name)
    if (logoFile.value) {
      fd.append('logo', logoFile.value)
    }

    await $fetch('/api/organization/settings', {
      method: 'PUT',
      body: fd,
    })
    await fetch() // refresh session
    message.value = 'Settings updated successfully!'
    org.name = form.name
    // update logo from session
    if (user.value?.organizationLogo) {
      org.logo = user.value.organizationLogo
    }
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Update failed',
      description: error.data?.statusMessage || error.message,
    })
  } finally {
    loading.value = false
  }
}
</script>