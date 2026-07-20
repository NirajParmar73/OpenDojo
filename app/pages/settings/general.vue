<template>
  <div class="max-w-2xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6">General Settings</h1>

    <form @submit.prevent="saveSettings" enctype="multipart/form-data">
      <div class="mb-4">
        <label class="block text-sm font-medium">Organization Name</label>
        <UInput v-model="form.name" class="w-full" required />
      </div>

      <div class="mb-4">
        <label class="block text-sm font-medium">Workspace subdomain</label>
        <UInput v-model="form.slug" class="w-full" placeholder="gojukai" autocapitalize="none" />
        <p class="mt-1 text-xs text-gray-500">Choose a short, unique address using letters, numbers, and hyphens. Changing it updates your workspace URL.</p>
      </div>

      <div class="mb-4">
        <label class="block text-sm font-medium">Currency</label>
        <USelect
          v-model="form.currency"
          :items="currencyOptions"
          placeholder="Select currency"
          class="w-full"
        />
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
definePageMeta({ middleware: ['auth', 'admin'] })

const { user, fetch } = useUserSession()
const toast = useToast()
const loading = ref(false)
const message = ref('')

const currencyOptions = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'JPY', 'INR', 'SGD', 'AED', 'ZAR', 'BRL', 'MXN'].map(value => ({ label: value, value }))

const org = reactive({
  name: '',
  slug: '',
  logo: null as string | null,
  currency: 'INR',
})

const form = reactive({
  name: '',
  slug: '',
  currency: 'INR',
})

const logoFile = ref<File | null>(null)

onMounted(async () => {
  try {
    const data = await $fetch('/api/organization/settings')
    org.name = data.name
    org.slug = data.slug
    org.logo = data.logo
    org.currency = data.currency || 'INR'
    form.name = data.name
    form.slug = data.slug
    form.currency = data.currency || 'INR'
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
    fd.append('slug', form.slug)
    fd.append('currency', form.currency)
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
    org.slug = form.slug
    org.currency = form.currency
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
