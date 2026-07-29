<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage/>
    </NuxtLayout>
    <PwaUpdatePrompt />
  </UApp>
</template>
<script setup>
import { classifyAppHost } from '#shared/utils/app-host'

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const requestUrl = useRequestURL()
const appHost = computed(() => classifyAppHost(requestUrl.hostname, String(runtimeConfig.public.tenantBaseDomain || '')))
const isStudentPortal = computed(() => appHost.value.surface === 'portal' || (appHost.value.surface === 'legacy' && route.path.startsWith('/portal')))
const isInstallableApp = computed(() => ['staff', 'portal', 'legacy'].includes(appHost.value.surface))

useHead(() => ({
  title: isStudentPortal.value ? 'OpenDojos Student' : 'OpenDojos',
  meta: [
    { property: 'og:image', content: '/brand/opendojos-logo.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'theme-color', content: '#b42318' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: isStudentPortal.value ? 'OpenDojos Student' : 'OpenDojos' },
  ],
  link: [
    { rel: 'icon', type: 'image/png', href: '/brand/opendojos-mark.png' },
    { rel: 'apple-touch-icon', href: isStudentPortal.value ? '/pwa-icon-192.png' : '/brand/opendojos-mark.png' },
    ...(isInstallableApp.value ? [{ rel: 'manifest', href: isStudentPortal.value ? '/portal/manifest.webmanifest' : '/manifest.webmanifest' }] : []),
  ],
}))
</script>
