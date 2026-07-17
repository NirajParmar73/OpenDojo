<template>
  <div class="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
    <header class="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-6 sm:px-8">
      <PlatformBrand />
      <NuxtLink to="/auth/login" class="text-sm font-medium text-primary hover:underline">Sign in</NuxtLink>
    </header>
    <main class="mx-auto w-full max-w-4xl px-5 pb-16 pt-8 sm:px-8 sm:pt-12"><slot /></main>
    <footer class="border-t border-slate-200 dark:border-slate-800">
      <div class="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 dark:text-slate-400">
        <span>© {{ new Date().getFullYear() }} OpenDojo</span>
        <nav class="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer navigation"><NuxtLink to="/pricing" class="hover:text-primary">Pricing</NuxtLink><NuxtLink to="/terms" class="hover:text-primary">Terms</NuxtLink><NuxtLink to="/privacy" class="hover:text-primary">Privacy</NuxtLink><NuxtLink to="/refund-policy" class="hover:text-primary">Refund policy</NuxtLink><NuxtLink to="/contact" class="hover:text-primary">Contact support</NuxtLink></nav>
      </div>
    </footer>
  </div>
</template>
