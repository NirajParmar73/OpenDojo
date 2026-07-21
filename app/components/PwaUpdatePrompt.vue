<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="translate-y-3 opacity-0"
    leave-active-class="transition duration-150 ease-in"
    leave-to-class="translate-y-3 opacity-0"
  >
    <div v-if="updateAvailable" class="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-md rounded-2xl border border-primary/20 bg-white p-4 shadow-xl dark:bg-slate-900 sm:left-auto sm:right-6">
      <div class="flex items-start gap-3">
        <div class="rounded-xl bg-primary/10 p-2 text-primary"><UIcon name="i-lucide-sparkles" class="h-5 w-5" /></div>
        <div class="min-w-0 flex-1"><p class="font-semibold">A new version is ready</p><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Refresh to use the latest OpenDojos features.</p></div>
      </div>
      <div class="mt-4 flex justify-end gap-2"><UButton color="neutral" variant="ghost" size="sm" @click="updateAvailable = false">Later</UButton><UButton size="sm" icon="i-lucide-refresh-cw" @click="refresh">Refresh now</UButton></div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const updateAvailable = useState<boolean>('pwa-update-available', () => false)
function refresh() { window.location.reload() }
</script>
