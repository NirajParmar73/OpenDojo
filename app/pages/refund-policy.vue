<template>
  <article>
    <p class="text-sm font-semibold text-primary">BILLING</p><h1 class="mt-2 text-4xl font-semibold tracking-tight">Refund Policy</h1><p class="mt-4 text-sm text-slate-500 dark:text-slate-400">Effective date: July 13, 2026</p>
    <div class="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm leading-6 text-slate-700 dark:text-slate-200">This policy applies to fees paid directly to {{ entityName }} for OpenDojo subscriptions. It does not cover payments made by students or guardians to an organization using OpenDojo; those payments are governed by that organization’s own policies.</div>
    <section v-for="section in sections" :key="section.title" class="mt-9"><h2 class="text-xl font-semibold">{{ section.title }}</h2><p v-for="paragraph in section.paragraphs" :key="paragraph" class="mt-3 leading-7 text-slate-600 dark:text-slate-300">{{ paragraph }}</p></section>
    <section class="mt-9"><h2 class="text-xl font-semibold">Request a refund</h2><p class="mt-3 leading-7 text-slate-600 dark:text-slate-300">Email <a :href="`mailto:${supportEmail}`" class="text-primary hover:underline">{{ supportEmail }}</a> from the billing email address with your organization name, invoice or receipt number, purchase date, and the reason for the request. We will acknowledge requests promptly and aim to provide a decision within 10 business days.</p></section>
  </article>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'legal' })
const { entityName, supportEmail } = useLegalContact()
useHead({ title: 'Refund Policy | OpenDojo' })
const sections = [
  { title: '1. Trial and cancellation', paragraphs: ['If your plan includes a free trial, you may cancel before the trial ends to avoid charges. You may cancel a paid subscription at any time; cancellation stops renewal at the end of the current paid period and does not ordinarily create a prorated refund.'] },
  { title: '2. Refund eligibility', paragraphs: ['If you purchased directly from us and believe you were charged in error, charged more than agreed, or could not use the Service because of a verified material service failure, contact us within 14 days of the charge. We will review the circumstances in good faith and, where appropriate, issue a full or partial refund or account credit.', 'Except where required by applicable law, we generally do not refund fees for elapsed subscription periods, change of mind, unused accounts, failure to cancel before renewal, or services suspended due to a breach of our Terms.'] },
  { title: '3. Third-party purchases and chargebacks', paragraphs: ['If you purchased through a marketplace, reseller, or app store, that provider’s refund process applies. Please contact us before initiating a chargeback so we can investigate and try to resolve the issue. We may suspend affected accounts while a disputed charge is reviewed.'] },
  { title: '4. Processing', paragraphs: ['Approved refunds are returned to the original payment method where possible. Bank or payment-provider processing times may vary. Taxes, currency-conversion fees, and charges collected by third parties may not be refundable unless required by law.'] },
]
</script>
