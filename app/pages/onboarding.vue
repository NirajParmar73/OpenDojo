<template>
  <div class="max-w-100 mx-auto">
    <h1 class="text-center">Start Your Organization</h1>
    <form @submit.prevent="onSubmit" class="space-y-3" enctype="multipart/form-data">
      <div>
        <label>Organization Name</label>
        <UInput v-model="form.organizationName" required />
      </div>
      <div>
        <label>Your Name</label>
        <UInput v-model="form.name" required />
      </div>
      <div>
        <label>Email Address</label>
        <UInput v-model="form.email" type="email" required />
      </div>
      <div>
        <label>Password</label>
        <UInput v-model="form.password" type="password" required />
      </div>
      <div>
        <label>Organization Logo (optional)</label>
        <UInput type="file" accept="image/*" @change="onFileChange" />
      </div>
      <UButton type="submit" :loading>Create Organization</UButton>
    </form>
    <p class="mt-4 text-center">
      Already have an account? <NuxtLink to="/auth/login" class="text-primary">Login</NuxtLink>
    </p>
  </div>
</template>

<script setup lang="ts">
const toast = useToast()
const loading = ref(false)
const form = reactive({
  organizationName: '',
  name: '',
  email: '',
  password: '',
})
const logoFile = ref<File | null>(null)

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  logoFile.value = target.files?.[0] ?? null
}

async function onSubmit() {
  loading.value = true
  try {
    const fd = new FormData()
    fd.append('organizationName', form.organizationName)
    fd.append('name', form.name)
    fd.append('email', form.email)
    fd.append('password', form.password)
    if (logoFile.value) {
      fd.append('logo', logoFile.value)
    }

    await $fetch('/api/onboarding', {
      method: 'POST',
      body: fd,
    })
    await navigateTo('/')
  } catch (error: any) {
  toast.add({ color: 'error', title: 'Onboarding failed', description: error.data?.statusMessage || error.message })
}
  finally {
    loading.value = false
  }
}
</script>