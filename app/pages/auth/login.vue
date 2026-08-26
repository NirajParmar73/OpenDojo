<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { z } from 'zod/v4'
import { classifyAppHost, platformAppUrl, portalAppUrl } from '#shared/utils/app-host'

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
const { user, loggedIn } = useUserSession()
const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const isPlayDistribution = usePlayDistribution()
definePageMeta({ layout: 'auth' })

const currentAppHost = classifyAppHost(useRequestURL().hostname, String(runtimeConfig.public.tenantBaseDomain || ''))

if (loggedIn.value) {
  const appHost = currentAppHost
  const target = user.value?.role === 'student'
    ? (appHost.surface === 'legacy' ? '/portal' : portalAppUrl(String(runtimeConfig.public.tenantBaseDomain || ''), appHost.tenantSlug))
    : user.value?.isPlatformAdmin
      ? (appHost.surface === 'legacy' ? '/platform' : platformAppUrl(String(runtimeConfig.public.tenantBaseDomain || '')))
      : '/'
  await navigateTo(target, { replace: true, external: target.startsWith('http') })
}

if (typeof route.query.email === 'string') state.email = route.query.email

async function onLogin(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    const response = await $fetch<{
      isPlatformAdmin?: boolean
      platformLoginRequired?: boolean
      workspaceLoginRequired?: boolean
      workspaceLoginUrl?: string
    }>('/api/auth/login', {
      method: 'POST',
      body: {
        email: event.data.email,
        password: event.data.password,
        client: isPlayDistribution.value ? 'play_admin' : undefined,
      },
    })
    // The server has already set the session cookie. Use a full navigation so
    // route middleware reads that new session reliably on the next request.
    if (response.isPlatformAdmin) {
      const appHost = classifyAppHost(window.location.hostname, String(runtimeConfig.public.tenantBaseDomain || ''))
      const target = appHost.surface === 'legacy'
        ? '/platform'
        : response.platformLoginRequired
          ? platformAppUrl(String(runtimeConfig.public.tenantBaseDomain || ''), `/auth/login?email=${encodeURIComponent(event.data.email)}`)
          : platformAppUrl(String(runtimeConfig.public.tenantBaseDomain || ''))
      window.location.assign(target)
      return
    }
    if (response.workspaceLoginRequired && response.workspaceLoginUrl) {
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = `${response.workspaceLoginUrl.replace(/\/$/, '')}/api/auth/login`
      const fields = {
        email: event.data.email,
        password: event.data.password,
        redirectTo: route.query.created === '1' ? '/getting-started?welcome=1' : isPlayDistribution.value ? '/?source=play' : '/',
      }
      for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = name
        input.value = value
        form.appendChild(input)
      }
      document.body.appendChild(form)
      form.submit()
      return
    }
    // A newly provisioned workspace continues into its role-specific guide.
    // Returning users begin on the dashboard as usual.
    window.location.assign(route.query.created === '1' ? '/getting-started?welcome=1' : '/')
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
    <UForm :schema :state class="space-y-4" @submit="onLogin">
      <UFormField name="email" label="Email Address">
        <UInput
          v-model="state.email"
          class="w-full"
          type="email"
          placeholder="Enter your email"
          required
        />
      </UFormField>
      <UFormField name="password" label="Password">
        <UInput
          v-model="state.password"
          class="w-full"
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
