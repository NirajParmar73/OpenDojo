<template>
  <div class="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
    <header class="sticky top-0 z-40 border-b border-slate-200/80 bg-slate-50/90 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/90">
      <div class="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <div class="flex min-w-0 items-center gap-4">
          <PlatformBrand />
          <span class="hidden h-6 w-px bg-slate-200 sm:block dark:bg-slate-800" />
          <NuxtLink to="/help" class="hidden text-sm font-semibold sm:block">Help Center</NuxtLink>
        </div>
        <nav class="hidden items-center gap-1 lg:flex" aria-label="Help navigation">
          <NuxtLink v-for="item in navigation" :key="item.to" :to="item.to" class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-primary dark:text-slate-300 dark:hover:bg-slate-900" active-class="!bg-primary/10 !text-primary">{{ item.label }}</NuxtLink>
        </nav>
        <div class="flex items-center gap-2">
          <button class="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" :aria-label="colorMode.value === 'dark' ? 'Use light mode' : 'Use dark mode'" @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"><UIcon :name="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'" class="h-4 w-4" /></button>
          <UButton :to="staffSignInUrl" color="neutral" variant="ghost" external class="hidden sm:inline-flex">Sign in</UButton>
          <button class="rounded-xl p-2.5 text-slate-600 lg:hidden dark:text-slate-300" aria-label="Open help navigation" @click="menuOpen = !menuOpen"><UIcon :name="menuOpen ? 'i-lucide-x' : 'i-lucide-menu'" class="h-5 w-5" /></button>
        </div>
      </div>
      <nav v-if="menuOpen" class="border-t border-slate-200 px-5 py-3 lg:hidden dark:border-slate-800" aria-label="Mobile help navigation">
        <div class="mx-auto grid max-w-7xl gap-1 sm:grid-cols-2">
          <NuxtLink v-for="item in navigation" :key="item.to" :to="item.to" class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-primary dark:text-slate-300 dark:hover:bg-slate-900" @click="menuOpen = false">{{ item.label }}</NuxtLink>
        </div>
      </nav>
    </header>

    <main><slot /></main>

    <footer class="mt-20 border-t border-slate-200 dark:border-slate-800">
      <div class="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto]">
        <div><PlatformBrand /><p class="mt-3 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">Plain-language help for running an organization and using the student portal.</p></div>
        <nav class="flex flex-wrap gap-x-5 gap-y-3 text-sm text-slate-500 dark:text-slate-400" aria-label="Footer navigation"><NuxtLink to="/" class="hover:text-primary">Home</NuxtLink><NuxtLink to="/pricing" class="hover:text-primary">Pricing</NuxtLink><NuxtLink to="/faq" class="hover:text-primary">FAQ</NuxtLink><NuxtLink to="/contact" class="hover:text-primary">Contact support</NuxtLink><NuxtLink to="/privacy" class="hover:text-primary">Privacy</NuxtLink></nav>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const colorMode = useColorMode()
const menuOpen = ref(false)
const { staffSignInUrl } = useApplicationUrls()
const navigation = [
  { label: 'Help home', to: '/help' },
  { label: 'For organizations', to: '/help/organizations' },
  { label: 'For students', to: '/help/students' },
  { label: 'Glossary', to: '/help/glossary' },
  { label: 'FAQ', to: '/faq' }
]
</script>
