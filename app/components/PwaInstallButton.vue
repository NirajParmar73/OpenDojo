<template>
  <div v-if="!isInstalled">
    <UButton size="sm" :icon="isInAppBrowser ? 'i-lucide-external-link' : 'i-lucide-download'" @click="install">
      {{ label }}
    </UButton>
    <div v-if="showInstallHelp" class="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center" @click.self="showInstallHelp = false">
      <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div class="flex items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UIcon :name="isInAppBrowser ? 'i-lucide-external-link' : isIos ? 'i-lucide-share' : 'i-lucide-download'" class="h-5 w-5" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-base font-semibold">{{ installTitle }}</p>
            <p class="mt-1 leading-5 text-slate-600 dark:text-slate-300">{{ installHelp }}</p>
          </div>
          <button type="button" class="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close install instructions" @click="showInstallHelp = false"><UIcon name="i-lucide-x" /></button>
        </div>
        <UButton
          v-if="isInAppBrowser && isAndroid"
          class="mt-5 w-full justify-center"
          size="lg"
          icon="i-lucide-external-link"
          @click="openInChrome"
        >
          Open in Chrome
        </UButton>
        <UButton
          v-else-if="installPromptAvailable"
          class="mt-5 w-full justify-center"
          size="lg"
          icon="i-lucide-download"
          @click="requestInstall"
        >
          Install now
        </UButton>
        <button v-if="isInAppBrowser" type="button" class="mt-3 w-full text-center text-xs font-medium text-slate-500 hover:text-primary" @click="copyCurrentLink">
          {{ linkCopied ? 'Link copied' : 'Copy link instead' }}
        </button>
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
const isInAppBrowser = ref(false)
const showInstallHelp = ref(false)
const linkCopied = ref(false)
const { label = 'Install app' } = defineProps<{ label?: string }>()
const installPromptAvailable = computed(() => Boolean(deferredPrompt.value))
const installTitle = computed(() => isInAppBrowser.value ? 'Open in Chrome to install' : 'Install on this device')
const installHelp = computed(() => {
  if (isInAppBrowser.value && isAndroid.value) return 'This app cannot be installed inside WhatsApp, Instagram, or Facebook. Tap the button below, then tap Install app in Chrome.'
  if (isInAppBrowser.value && isIos.value) return 'Open this page in Safari. Then tap Share and Add to Home Screen.'
  if (isIos.value) return 'In Safari, tap Share, then choose “Add to Home Screen”.'
  if (isAndroid.value) return 'Open your browser menu and choose “Install app” or “Add to Home screen”.'
  return 'Open the browser menu and choose “Install OpenDojos” or “Install app”. Chrome and Microsoft Edge provide the most consistent installation support.'
})

async function install() {
  if (isInAppBrowser.value || !deferredPrompt.value) {
    showInstallHelp.value = true
    return
  }
  await requestInstall()
}

async function requestInstall() {
  if (!deferredPrompt.value) return
  showInstallHelp.value = false
  const promptEvent = deferredPrompt.value
  try {
    await promptEvent.prompt()
    await promptEvent.userChoice
  } catch {
    showInstallHelp.value = true
  } finally {
    deferredPrompt.value = null
  }
}

function openInChrome() {
  const currentUrl = new URL(window.location.href)
  const fallbackUrl = encodeURIComponent(currentUrl.href)
  const intentPath = `${currentUrl.host}${currentUrl.pathname}${currentUrl.search}`
  window.location.href = `intent://${intentPath}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallbackUrl};end`
}

async function copyCurrentLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    linkCopied.value = true
  } catch {
    window.prompt('Copy this link and open it in Chrome:', window.location.href)
  }
}

onMounted(() => {
  const userAgent = window.navigator.userAgent
  isIos.value = /iphone|ipad|ipod/i.test(userAgent)
  isAndroid.value = /android/i.test(userAgent)
  isInAppBrowser.value = /FBAN|FBAV|Instagram|WhatsApp|LinkedInApp|Twitter|Line\/|; wv\)|\bwv\b/i.test(userAgent)
  isInstalled.value = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  window.addEventListener('appinstalled', markInstalled)
  if (isInAppBrowser.value) showInstallHelp.value = true
})
onBeforeUnmount(() => window.removeEventListener('appinstalled', markInstalled))
function markInstalled() { isInstalled.value = true }
</script>
