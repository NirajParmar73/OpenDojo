<template>
  <div class="mx-auto mt-10 max-w-md sm:mt-16">
    <UCard>
      <template #header>
        <div>
          <p class="text-xs font-semibold tracking-[0.18em] text-primary">OPENDOJOS STUDENT</p>
          <h1 class="mt-1 text-xl font-semibold">Student portal</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in with the portal username and password shared by your dojo.</p>
        </div>
      </template>
      <form class="space-y-4" @submit.prevent="login">
        <UFormField label="Portal username"><UInput v-model="username" autocomplete="username" required /></UFormField>
        <UFormField label="Password"><UInput v-model="password" type="password" autocomplete="current-password" required /></UFormField>
        <UButton type="submit" class="w-full" :loading="loading">Sign in</UButton>
      </form>
      <div class="mt-6 rounded-xl bg-primary/10 p-4 text-sm text-slate-700 dark:text-slate-200">
        <p class="font-medium text-slate-900 dark:text-white">Install the Student app</p>
        <p class="mt-1 leading-5">Use the <strong>Install Student app</strong> button above. If it is not shown, open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</p>
      </div>
    </UCard>
  </div>
</template>
<script setup lang="ts">definePageMeta({ layout: 'portal' }); const username = ref(''); const password = ref(''); const loading = ref(false); const toast = useToast(); const router = useRouter(); const { fetch } = useUserSession(); async function login() { loading.value = true; try { await $fetch('/api/portal/login', { method: 'POST', body: { username: username.value, password: password.value } }); await fetch(); router.push('/portal') } catch (error: any) { toast.add({ color: 'error', title: 'Login failed', description: error.data?.statusMessage || 'Invalid credentials' }) } finally { loading.value = false } }</script>
