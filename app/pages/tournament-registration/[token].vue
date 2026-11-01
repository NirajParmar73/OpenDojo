<template>
  <div class="mx-auto max-w-2xl">
    <UCard v-if="pending"><USkeleton class="h-80" /></UCard>
    <UAlert v-else-if="error" color="error" icon="i-lucide-circle-alert" title="Participation form unavailable" :description="error.data?.statusMessage || 'Check the link with your tournament administrator.'" />
    <UCard v-else-if="receipt" class="text-center">
      <UIcon name="i-lucide-circle-check" class="mx-auto size-14 text-emerald-500" />
      <h1 class="mt-4 text-2xl font-semibold">Participation registered</h1>
      <p class="mt-3 text-slate-600 dark:text-slate-300">Your details have been sent to the administrator for {{ data?.tournament.name }}.</p>
      <div class="mx-auto mt-6 max-w-xs rounded-xl bg-slate-100 p-5 dark:bg-slate-800"><p class="text-xs uppercase tracking-wide text-slate-500">Registration reference</p><p class="mt-2 font-mono text-xl font-semibold">{{ receipt.reference }}</p></div>
      <p class="mt-5 text-sm text-slate-500">Keep this reference. Contact your tournament administrator if you need to correct your details.</p>
      <UButton class="mt-6" color="neutral" variant="outline" @click="registerAnother">Register another player</UButton>
    </UCard>
    <template v-else-if="data">
      <section class="mb-6 rounded-2xl bg-gradient-to-br from-teal-900 to-emerald-800 p-6 text-white sm:p-8">
        <p class="text-sm text-teal-100">{{ data.organizationName }}</p>
        <h1 class="mt-2 text-2xl font-semibold sm:text-3xl">{{ data.tournament.name }}</h1>
        <p class="mt-3 text-sm text-teal-50">{{ formatDate(data.tournament.startDate) }}<template v-if="data.tournament.endDate"> – {{ formatDate(data.tournament.endDate) }}</template><template v-if="data.tournament.venue"> · {{ data.tournament.venue }}</template></p>
        <p v-if="data.tournament.coachName" class="mt-2 text-sm text-teal-50">Coach: {{ data.tournament.coachName }}</p>
        <div class="mt-5 border-t border-white/20 pt-4"><h2 class="font-medium">Tournament participation form</h2><p class="mt-1 text-sm text-teal-100">Register one player at a time. No account is required.</p></div>
      </section>
      <UAlert v-if="!data.tournament.registrationEnabled" color="warning" icon="i-lucide-lock-keyhole" title="Registration is closed" description="Contact your tournament administrator for further participation requests." />
      <UAlert v-else-if="!data.beltOptions.length" color="warning" title="Belts are not configured yet" description="Contact your tournament administrator to set up the organization's belts before registering." />
      <form v-else class="space-y-5" @submit.prevent="submit">
        <UCard><TournamentParticipantFields v-model="form" :cutoff-date="data.tournament.ageCutoffDate" :belt-options="data.beltOptions" /></UCard>
        <UCard><UCheckbox v-model="consent" required label="I confirm these participation details are correct and agree to share them with the tournament administrator and organizer." /></UCard>
        <input v-model="website" tabindex="-1" autocomplete="off" class="absolute left-[-9999px]" aria-hidden="true" aria-label="Leave empty">
        <UAlert v-if="submitError" role="alert" color="error" title="Could not submit participation" :description="submitError" />
        <UButton type="submit" size="xl" block icon="i-lucide-send" :loading="submitting" :disabled="submitting">Submit participation</UButton>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admission' })
useHead({ title: 'Tournament participation | OpenDojos', meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
const route = useRoute()
const token = String(route.params.token || '')
const { data, pending, error } = await useFetch(`/api/public/tournaments/${token}/form`)
const emptyForm = () => ({ fullName: '', dateOfBirth: '', weightKg: undefined as number | undefined, gender: '', belt: '', ageCategory: '', kata: false, kumite: false })
const form = ref(emptyForm())
const consent = ref(false)
const website = ref('')
const submitting = ref(false)
const submitError = ref('')
const receipt = ref<{ reference: string } | null>(null)
let requestKey = ''
function formatDate(value: string) { return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) }
function registerAnother() { form.value = emptyForm(); consent.value = false; receipt.value = null; submitError.value = ''; requestKey = '' }
async function submit() {
  if (submitting.value) return
  submitError.value = ''
  if (!form.value.kata && !form.value.kumite) { submitError.value = 'Select Kata, Kumite, or both.'; return }
  if (!consent.value) { submitError.value = 'Confirm your details before submitting.'; return }
  submitting.value = true
  requestKey ||= crypto.randomUUID()
  try {
    receipt.value = await $fetch(`/api/public/tournaments/${token}`, { method: 'POST', body: { ...form.value, weightKg: Number(form.value.weightKg), requestKey, consent: consent.value, website: website.value } })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (cause: any) { submitError.value = cause.data?.statusMessage || 'Registration could not be saved. Please try again.' }
  finally { submitting.value = false }
}
</script>
