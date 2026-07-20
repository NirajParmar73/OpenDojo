<template>
  <UButton v-if="deferredPrompt && !isInstalled" size="sm" icon="i-lucide-download" @click="install">
    Install app
  </UButton>
</template>

<script setup lang="ts">
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const deferredPrompt = useState<BeforeInstallPromptEvent | null>('pwa-install-prompt', () => null)
const isInstalled = ref(false)

async function install() {
  if (!deferredPrompt.value) return
  await deferredPrompt.value.prompt()
  const { outcome } = await deferredPrompt.value.userChoice
  if (outcome === 'accepted') deferredPrompt.value = null
}

onMounted(() => {
  isInstalled.value = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  window.addEventListener('appinstalled', () => { isInstalled.value = true })
})
</script>
