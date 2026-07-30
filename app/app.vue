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
const isPlatformApp = computed(() => appHost.value.surface === 'platform')
const isInstallableApp = computed(() => ['platform', 'staff', 'portal', 'legacy'].includes(appHost.value.surface))
const appBrand = computed(() => {
  if (isStudentPortal.value) {
    return {
      title: 'OpenDojos Student',
      themeColor: '#b42318',
      manifest: '/portal/manifest.webmanifest',
      icon: '/student-pwa-icon-192.png',
      appleTouchIcon: '/student-pwa-icon-180.png'
    }
  }
  if (isPlatformApp.value) {
    return {
      title: 'OpenDojos Platform',
      themeColor: '#3730a3',
      manifest: '/platform/manifest.webmanifest',
      icon: '/platform-pwa-icon-192.png',
      appleTouchIcon: '/platform-pwa-icon-180.png'
    }
  }
  if (appHost.value.surface === 'staff' || appHost.value.surface === 'legacy') {
    return {
      title: 'OpenDojos Admin',
      themeColor: '#0f766e',
      manifest: '/manifest.webmanifest',
      icon: '/admin-pwa-icon-192.png',
      appleTouchIcon: '/admin-pwa-icon-180.png'
    }
  }
  return {
    title: 'OpenDojos',
    themeColor: '#b42318',
    manifest: '/manifest.webmanifest',
    icon: '/brand/opendojos-mark.png',
    appleTouchIcon: '/brand/opendojos-mark.png'
  }
})

useHead(() => ({
  title: appBrand.value.title,
  meta: [
    { property: 'og:image', content: '/brand/opendojos-logo.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'theme-color', content: appBrand.value.themeColor },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: appBrand.value.title },
  ],
  link: [
    { rel: 'icon', type: 'image/png', href: appBrand.value.icon },
    { rel: 'apple-touch-icon', sizes: '180x180', href: appBrand.value.appleTouchIcon },
    ...(isInstallableApp.value
      ? [{ rel: 'manifest', href: appBrand.value.manifest }]
      : []),
  ],
}))
</script>
