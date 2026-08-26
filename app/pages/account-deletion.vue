<template>
  <div class="mx-auto max-w-3xl">
    <section class="mb-7">
      <p class="text-sm font-semibold text-primary">PRIVACY</p>
      <h1 class="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Request account and data deletion</h1>
      <p class="mt-4 leading-7 text-slate-600 dark:text-slate-300">Use this form for an OpenDojos organization, staff account, or student portal account. You can submit it without signing in.</p>
    </section>
    <UCard><AccountDeletionRequest /></UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'help' })
useHead({ title: 'Account Deletion | OpenDojos' })
useSeoMeta({ description: 'Request deletion of an OpenDojos organization, staff account, student portal account, and associated data.' })
</script>
