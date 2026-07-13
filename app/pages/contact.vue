<template>
  <article>
    <p class="text-sm font-semibold text-primary">SUPPORT</p><h1 class="mt-2 text-4xl font-semibold tracking-tight">Contact customer support</h1><p class="mt-5 max-w-2xl leading-7 text-slate-600 dark:text-slate-300">Our support team can help with account access, workspace setup, billing questions, and technical issues. To protect your organization’s data, please do not send passwords, payment card details, or sensitive student documents by email.</p>
    <section class="mt-9 grid gap-5 sm:grid-cols-2">
      <a :href="`mailto:${supportEmail}`" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-primary/40 dark:border-slate-800 dark:bg-slate-900"><UIcon name="i-lucide-mail" class="h-6 w-6 text-primary" /><h2 class="mt-4 font-semibold">Email support</h2><p class="mt-2 text-sm text-slate-500 dark:text-slate-400">For account, billing, and technical help.</p><p class="mt-4 font-medium text-primary">{{ supportEmail }}</p></a>
      <div v-if="supportPhone" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"><UIcon name="i-lucide-phone" class="h-6 w-6 text-primary" /><h2 class="mt-4 font-semibold">Phone support</h2><p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Available during published business hours.</p><p class="mt-4 font-medium">{{ supportPhone }}</p></div>
      <div v-else class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"><UIcon name="i-lucide-clock-3" class="h-6 w-6 text-primary" /><h2 class="mt-4 font-semibold">Response time</h2><p class="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">We aim to acknowledge support requests within two business days. Urgent account-security concerns are prioritized.</p></div>
    </section>
    <section class="mt-9 rounded-2xl bg-slate-900 p-6 text-slate-100 dark:bg-slate-900"><h2 class="text-xl font-semibold">Help us resolve your request quickly</h2><ul class="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300"><li>Use the email address associated with your OpenDojo account.</li><li>Include your organization name and a clear description of the issue.</li><li>For errors, include the page URL, approximate time, and screenshots with sensitive details hidden.</li></ul></section>
    <section v-if="legalAddress" class="mt-9"><h2 class="text-xl font-semibold">Business contact</h2><p class="mt-3 whitespace-pre-line leading-7 text-slate-600 dark:text-slate-300">{{ entityName }}\n{{ legalAddress }}</p></section>
  </article>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'legal' })
const { entityName, supportEmail, supportPhone, legalAddress } = useLegalContact()
useHead({ title: 'Contact Support | OpenDojo' })
</script>
