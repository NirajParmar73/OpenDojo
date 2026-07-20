<template>
  <div class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <header class="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div
        class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6"
      >
        <NuxtLink to="/portal" class="font-semibold text-primary">
          Open Dojo
          <span class="font-normal text-slate-500">Student portal</span>
        </NuxtLink>
        <div class="flex items-center gap-3">
          <PwaInstallButton />
          <button
            v-if="loggedIn"
            class="text-sm font-medium text-slate-600 hover:text-red-600 dark:text-slate-300"
            @click="logout"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
    <main class="px-4 py-8 sm:px-6">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const { loggedIn, clear } = useUserSession()
const router = useRouter()

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  await router.push('/portal/login')
}
</script>
