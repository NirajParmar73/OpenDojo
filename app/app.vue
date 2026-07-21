<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage/>
    </NuxtLayout>
    <PwaUpdatePrompt />
  </UApp>
</template>
<script setup>
useHead({
  title: 'OpenDojos',
  meta: [
    { property: 'og:image', content: '/brand/opendojos-logo.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'theme-color', content: '#0f766e' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: 'OpenDojos' },
  ],
  link: [
    { rel: 'icon', type: 'image/png', href: '/brand/opendojos-mark.png' },
    { rel: 'apple-touch-icon', href: '/brand/opendojos-mark.png' },
    { rel: 'manifest', href: '/manifest.webmanifest' },
  ],
})
</script>
