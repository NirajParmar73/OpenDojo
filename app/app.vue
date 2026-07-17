<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage/>
    </NuxtLayout>
  </UApp>
</template>
<script setup>
useHead({
  title: 'OpenDojos',
  meta: [
    { property: 'og:image', content: '/brand/opendojos-logo.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ],
  link: [
    { rel: 'icon', type: 'image/png', href: '/brand/opendojos-mark.png' },
    { rel: 'apple-touch-icon', href: '/brand/opendojos-mark.png' },
  ],
})
</script>
