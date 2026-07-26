<template>
  <div v-if="!isInstalled">
    <UButton v-if="deferredPrompt || isIos" size="sm" icon="i-lucide-download" @click="install">
      {{ label }}
    </UButton>
    <div v-if="showIosHelp" class="fixed inset-x-4 bottom-4 z-[110] mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <div class="flex items-start gap-3">
        <UIcon name="i-lucide-share" class="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div class="min-w-0 flex-1">
          <p class="font-semibold">Install on this device</p>
          <p class="mt-1 leading-5 text-slate-500 dark:text-slate-400">In Safari, tap Share, then choose “Add to Home Screen”.</p>
        </div>
        <button type="button" class="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close install instructions" @click="showIosHelp = false"><UIcon name="i-lucide-x" /></button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const deferredPrompt = useState<BeforeInstallPromptEvent | null>('pwa-install-prompt', () => null)
const isInstalled = ref(false)
const isIos = ref(false)
const showIosHelp = ref(false)
const { label = 'Install app' } = defineProps<{ label?: string }>()

async function install() {
  if (!deferredPrompt.value) {
    showIosHelp.value = isIos.value
    return
  }
  await deferredPrompt.value.prompt()
  const { outcome } = await deferredPrompt.value.userChoice
  if (outcome === 'accepted') deferredPrompt.value = null
}

onMounted(() => {
  isIos.value = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
  isInstalled.value = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  window.addEventListener('appinstalled', markInstalled)
})
onBeforeUnmount(() => window.removeEventListener('appinstalled', markInstalled))
function markInstalled() { isInstalled.value = true }
</script>
