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
const { user } = useUserSession()
const route = useRoute()
definePageMeta({ layout: 'auth' })

if (route.query.created === '1' && typeof route.query.email === 'string') state.email = route.query.email

async function onLogin(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    const response = await $fetch<{ workspaceUrl?: string, isPlatformAdmin?: boolean }>('/api/auth/login', {
      method: 'POST',
      body: {
        email: event.data.email,
        password: event.data.password,
      },
    })
    // The server has already set the session cookie. Use a full navigation so
    // route middleware reads that new session reliably on the next request.
    if (response.isPlatformAdmin) {
      window.location.assign('/platform')
      return
    }
    if (!user.value?.isPlatformAdmin && response.workspaceUrl && new URL(response.workspaceUrl).host !== window.location.host) {
      window.location.assign(response.workspaceUrl)
      return
    }
    // Platform operators begin in the platform console; everyone else uses
    // their organization workspace dashboard.
    window.location.assign('/')
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
    <UAlert v-if="route.query.created === '1'" class="mb-5" color="success" icon="i-lucide-circle-check" title="Your workspace is ready" description="Sign in to start adding students, recording payments, and managing your dojo." />
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
