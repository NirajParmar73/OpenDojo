<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage/>
    </NuxtLayout>
    <PwaUpdatePrompt />
  </UApp>
</template>
<script setup>
const route = useRoute()
const isStudentPortal = computed(() => route.path.startsWith('/portal'))

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
    { rel: 'manifest', href: isStudentPortal.value ? '/portal/manifest.webmanifest' : '/manifest.webmanifest' },
  ],
}))
</script>
