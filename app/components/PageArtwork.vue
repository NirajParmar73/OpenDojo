<template>
  <figure class="relative mb-6 hidden overflow-hidden rounded-2xl border border-slate-200 bg-[#f7efe0] shadow-sm sm:block dark:border-slate-800 dark:bg-slate-900">
    <img
      :src="art.src"
      :alt="art.alt"
      class="h-36 w-full object-cover object-right opacity-90 transition duration-500 dark:opacity-60"
    >
    <div class="absolute inset-0 bg-gradient-to-r from-[#f7efe0] via-[#f7efe0]/80 to-transparent dark:from-slate-900 dark:via-slate-900/75" />
    <figcaption class="absolute inset-y-0 left-0 flex max-w-md items-center px-6">
      <div>
        <p class="text-xs font-semibold tracking-[0.16em] text-primary">OPENDOJOS</p>
        <p class="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{{ art.caption }}</p>
      </div>
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
const route = useRoute()

const art = computed(() => {
  if (route.path.includes('belt') || route.path.includes('grading') || route.path.includes('promotion') || route.path.includes('certificate')) {
    return {
      src: '/illustrations/page-graphics/belt-promotion-watercolor.png',
      alt: 'Martial arts belt promotion ceremony',
      caption: 'Celebrate every step in a student’s progression.',
    }
  }

  if (route.path.includes('finance') || route.path.includes('fee') || route.path.includes('receipt') || route.path.includes('pricing') || route.path.includes('contact') || route.path.includes('report')) {
    return {
      src: '/illustrations/page-graphics/support-finance-watercolor.png',
      alt: 'Dojo administrator managing support and finances',
      caption: 'Clear support, confident decisions, and a well-run dojo.',
    }
  }

  return {
    src: '/illustrations/page-graphics/class-management-watercolor.png',
    alt: 'Martial arts class training in a dojo',
    caption: 'Keep your people, classes, and operations in sync.',
  }
})
</script>
