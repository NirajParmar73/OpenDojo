<template>
  <div class="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
    <header class="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
      <NuxtLink to="/" class="flex items-center gap-3"><span class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white">O</span><span><span class="block font-semibold">OpenDojo</span><span class="block text-xs text-slate-500 dark:text-slate-400">Dojo operations</span></span></NuxtLink>
      <div class="flex items-center gap-3"><button class="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" :aria-label="colorMode.value === 'dark' ? 'Use light mode' : 'Use dark mode'" @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"><UIcon :name="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'" class="h-4 w-4" /></button><NuxtLink to="/onboarding" class="text-sm font-medium text-primary hover:underline">Start an organization</NuxtLink></div>
    </header>
    <main class="mx-auto flex w-full max-w-6xl items-center justify-center px-5 pb-12 pt-8 sm:px-8 sm:pt-14"><div class="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-8"><slot /></div></main>
  </div>
</template>
<script setup lang="ts">
const colorMode = useColorMode()
</script>
