<template>
  <div v-if="!isInstalled">
    <UButton size="sm" icon="i-lucide-download" @click="install">
      {{ label }}
    </UButton>
    <div v-if="showInstallHelp" class="fixed inset-x-4 bottom-4 z-[110] mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <div class="flex items-start gap-3">
        <UIcon :name="isIos ? 'i-lucide-share' : 'i-lucide-download'" class="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div class="min-w-0 flex-1">
          <p class="font-semibold">Install on this device</p>
          <p class="mt-1 leading-5 text-slate-500 dark:text-slate-400">{{ installHelp }}</p>
          <p class="mt-2 text-xs leading-5 text-slate-400">Installation requires a supported browser and a secure HTTPS connection, except on localhost.</p>
        </div>
        <button type="button" class="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close install instructions" @click="showInstallHelp = false"><UIcon name="i-lucide-x" /></button>
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
const isAndroid = ref(false)
const showInstallHelp = ref(false)
const { label = 'Install app' } = defineProps<{ label?: string }>()
const installHelp = computed(() => {
  if (isIos.value) return 'In Safari, tap Share, then choose “Add to Home Screen”.'
  if (isAndroid.value) return 'Open your browser menu and choose “Install app” or “Add to Home screen”.'
  return 'Open the browser menu and choose “Install OpenDojos” or “Install app”. Chrome and Microsoft Edge provide the most consistent desktop installation support.'
})

async function install() {
  if (!deferredPrompt.value) {
    showInstallHelp.value = true
    return
  }
  await deferredPrompt.value.prompt()
  const { outcome } = await deferredPrompt.value.userChoice
  deferredPrompt.value = null
  if (outcome === 'accepted') isInstalled.value = true
}

onMounted(() => {
  isIos.value = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
  isAndroid.value = /android/i.test(window.navigator.userAgent)
  isInstalled.value = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  window.addEventListener('appinstalled', markInstalled)
})
onBeforeUnmount(() => window.removeEventListener('appinstalled', markInstalled))
function markInstalled() { isInstalled.value = true }
</script>
