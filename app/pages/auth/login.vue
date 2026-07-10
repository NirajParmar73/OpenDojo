<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { z } from 'zod/v4'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
})

type Schema = z.output<typeof schema>

const state = reactive({
  email: '',
  password: '',
})

const loading = ref(false)
const toast = useToast()
const { fetch } = useUserSession()
const router = useRouter()

async function onLogin(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        email: event.data.email,
        password: event.data.password,
      },
    })
    // Refresh session data
    await fetch()
    // Redirect to dashboard
    router.push('/')
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Login failed',
      description: error.data?.statusMessage || 'Invalid credentials',
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-md mx-auto mt-10">
    <h1 class="text-2xl font-bold text-center mb-6">Login</h1>
    <UForm :schema :state @submit="onLogin" class="space-y-4">
      <UFormField name="email" label="Email Address">
        <UInput
          class="w-full"
          v-model="state.email"
          type="email"
          placeholder="Enter your email"
          required
        />
      </UFormField>
      <UFormField name="password" label="Password">
        <UInput
          class="w-full"
          v-model="state.password"
          type="password"
          placeholder="Enter your password"
          required
        />
      </UFormField>
      <UButton type="submit" class="w-full" :loading="loading">
        Login
      </UButton>
    </UForm>
    <p class="mt-4 text-center text-sm">
      Don't have an account?
      <NuxtLink to="/onboarding" class="text-primary hover:underline">
        Start your organization
      </NuxtLink>
    </p>
  </div>
</template>