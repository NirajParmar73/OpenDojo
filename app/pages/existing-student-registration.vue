<template>
  <div>
    <UCard v-if="pending"><USkeleton class="h-96" /></UCard>
    <UAlert v-else-if="loadError" color="error" title="Registration form unavailable" :description="loadError" />
    <UCard v-else-if="submitted" class="mx-auto max-w-2xl text-center">
      <UIcon name="i-lucide-circle-check" class="mx-auto h-14 w-14 text-emerald-500" />
      <h1 class="mt-4 text-2xl font-semibold">Registration submitted</h1>
      <p class="mt-3 text-slate-500">Your organization will review your details. Portal access is created only after a manager approves the registration.</p>
      <div class="mx-auto mt-5 max-w-sm rounded-xl bg-slate-100 p-4 dark:bg-slate-800"><p class="text-xs uppercase text-slate-500">Reference number</p><p class="mt-1 font-mono font-semibold">{{ submitted.referenceNumber }}</p></div>
    </UCard>
    <template v-else-if="data">
      <section class="mb-7 overflow-hidden rounded-2xl bg-gradient-to-br from-teal-700 to-emerald-700 p-6 text-white shadow-lg sm:p-8">
        <div class="flex items-center gap-4"><img v-if="data.organization.logo" :src="data.organization.logo" :alt="`${data.organization.name} logo`" class="h-16 w-16 rounded-2xl bg-white object-contain p-2"><div><p class="text-sm text-teal-100">{{ data.organization.name }}</p><h1 class="mt-1 text-2xl font-semibold sm:text-3xl">{{ data.form.title }}</h1></div></div>
        <p class="mt-5 max-w-3xl text-sm leading-6 text-teal-50">{{ data.form.introduction }}</p>
        <p class="mt-3 text-sm font-medium text-white">No login is required. Submitting this form does not immediately create portal access.</p>
      </section>
      <form class="space-y-6" @submit.prevent="submitRegistration">
        <UCard><template #header><h2 class="font-semibold">Existing membership</h2></template><div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Current dojo / location" required><USelect v-model="form.dojoId" :items="dojoOptions" class="w-full" required /></UFormField>
          <UFormField label="Current program"><USelect v-model="form.programId" :items="programOptions" class="w-full" placeholder="Choose a program" /></UFormField>
          <UFormField label="Original joining date" required help="When you first joined this organization"><UInput v-model="form.originalJoinedAt" type="date" :max="today" class="w-full" required /></UFormField>
          <UFormField label="Membership / student number"><UInput v-model="form.membershipNumber" class="w-full" placeholder="If your organization issued one" /></UFormField>
          <UFormField label="Current belt / rank"><USelect v-model="form.currentBeltRankId" :items="beltOptions" class="w-full" placeholder="Choose your current rank" /></UFormField>
          <UFormField label="Rank awarded date"><UInput v-model="form.currentBeltAwardedAt" type="date" :max="today" class="w-full" /></UFormField>
        </div></UCard>
        <UCard><template #header><h2 class="font-semibold">Student information</h2></template><div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="First name" required><UInput v-model="form.firstName" required /></UFormField><UFormField label="Last name" required><UInput v-model="form.lastName" required /></UFormField>
          <UFormField label="Date of birth" required><UInput v-model="form.dateOfBirth" type="date" :max="today" required /></UFormField><UFormField label="Gender"><USelect v-model="form.gender" :items="genderOptions" placeholder="Optional" /></UFormField>
          <UFormField label="Email" required><UInput v-model="form.email" type="email" required /></UFormField><UFormField label="Phone" required><UInput v-model="form.phone" type="tel" required /></UFormField>
          <UFormField label="Street address" class="sm:col-span-2"><UInput v-model="form.address" /></UFormField><UFormField label="City"><UInput v-model="form.city" :readonly="Boolean(selectedDojo?.city)" /></UFormField><UFormField label="State / province"><UInput v-model="form.stateProvince" :readonly="Boolean(selectedDojo?.stateProvince)" /></UFormField><UFormField label="Country"><UInput v-model="form.country" :readonly="Boolean(selectedDojo?.country)" /></UFormField><UFormField label="Postal / ZIP code"><UInput v-model="form.postalCode" /></UFormField>
        </div></UCard>
        <UCard><template #header><h2 class="font-semibold">Profile photograph</h2></template><div class="flex flex-col gap-4 sm:flex-row sm:items-center"><div class="flex h-40 w-32 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed"><img v-if="photoPreview" :src="photoPreview" alt="Preview" class="h-full w-full object-cover"><UIcon v-else name="i-lucide-user-round" class="h-12 w-12 text-slate-300" /></div><div><input ref="photoInput" type="file" class="hidden" accept="image/jpeg,image/png,image/webp" capture="user" @change="choosePhoto"><UButton type="button" icon="i-lucide-camera" @click="photoInput?.click()">Take or upload picture</UButton><p class="mt-2 text-xs text-slate-500">JPG, PNG, or WebP, up to 5 MB.</p></div></div></UCard>
        <UCard><template #header><h2 class="font-semibold">Guardian, emergency and medical details</h2></template><div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Guardian name" :required="isMinor"><UInput v-model="form.guardianName" :required="isMinor" /></UFormField><UFormField label="Relationship" :required="isMinor"><UInput v-model="form.guardianRelationship" :required="isMinor" /></UFormField><UFormField label="Guardian phone" :required="isMinor"><UInput v-model="form.guardianPhone" type="tel" :required="isMinor" /></UFormField><UFormField label="Guardian email"><UInput v-model="form.guardianEmail" type="email" /></UFormField>
          <UFormField label="Emergency contact" required><UInput v-model="form.emergencyContact" required /></UFormField><UFormField label="Emergency phone" required><UInput v-model="form.emergencyPhone" type="tel" required /></UFormField><UFormField label="Medical information" class="sm:col-span-2"><UTextarea v-model="form.medicalNotes" :rows="3" /></UFormField>
        </div></UCard>
        <UCard><template #header><h2 class="font-semibold">Declaration and consent</h2></template><p class="text-sm text-slate-600 dark:text-slate-300">{{ data.form.privacyNotice }}</p><p class="mt-3 text-sm">{{ data.form.consentText }}</p><UCheckbox v-model="form.consent" class="mt-4" label="I accept this declaration and consent." required /><input v-model="form.website" tabindex="-1" autocomplete="off" class="absolute -left-[9999px]" aria-hidden="true"></UCard>
        <UAlert v-if="submitError" color="error" title="Could not submit registration" :description="submitError" /><div class="flex justify-end"><UButton type="submit" size="xl" icon="i-lucide-send" :loading="submitting">Submit for manager approval</UButton></div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admission' })
const route = useRoute(); const query = computed(() => route.query.organization ? { organization: String(route.query.organization) } : undefined)
const { data, pending, error } = await useFetch<any>('/api/public/existing-student-registrations/form', { query })
const loadError = computed(() => error.value?.data?.statusMessage || error.value?.message || '')
const today = new Date().toISOString().slice(0, 10)
const form = reactive({ dojoId: null as number | null, programId: null as number | null, currentBeltRankId: null as number | null, originalJoinedAt: '', currentBeltAwardedAt: '', membershipNumber: '', firstName: '', lastName: '', dateOfBirth: '', gender: undefined as string | undefined, email: '', phone: '', address: '', city: '', stateProvince: '', country: '', postalCode: '', guardianName: '', guardianRelationship: '', guardianPhone: '', guardianEmail: '', emergencyContact: '', emergencyPhone: '', medicalNotes: '', consent: false, website: '' })
const photo = ref<File | null>(null); const photoPreview = ref(''); const photoInput = ref<HTMLInputElement | null>(null); const submitting = ref(false); const submitError = ref(''); const submitted = ref<any>(null)
const dojoOptions = computed(() => (data.value?.dojos || []).map((dojo: any) => ({ label: `${dojo.name}${dojo.city ? ` — ${dojo.city}` : ''}`, value: dojo.id })))
const selectedDojo = computed(() => (data.value?.dojos || []).find((dojo: any) => dojo.id === form.dojoId))
watch(selectedDojo, dojo => { form.city = dojo?.city || ''; form.stateProvince = dojo?.stateProvince || ''; form.country = dojo?.country || '' })
const programOptions = computed(() => (data.value?.programs || []).map((program: any) => ({ label: program.displayName, value: program.id })))
const beltOptions = computed(() => (data.value?.beltRanks || []).filter((rank: any) => !form.programId || !rank.programId || rank.programId === form.programId).map((rank: any) => ({ label: rank.name, value: rank.id })))
watch(() => form.programId, () => { if (!(data.value?.beltRanks || []).some((rank: any) => rank.id === form.currentBeltRankId && (!form.programId || !rank.programId || rank.programId === form.programId))) form.currentBeltRankId = null })
const genderOptions = [{ label: 'Male', value: 'male' }, { label: 'Female', value: 'female' }, { label: 'Other', value: 'other' }]
const isMinor = computed(() => { if (!form.dateOfBirth) return false; const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 18); return new Date(`${form.dateOfBirth}T00:00:00`) > cutoff })
function choosePhoto(event: Event) { const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return; if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { submitError.value = 'Choose a JPG, PNG, or WebP photograph up to 5 MB.'; input.value = ''; return }; if (photoPreview.value) URL.revokeObjectURL(photoPreview.value); photo.value = file; photoPreview.value = URL.createObjectURL(file); submitError.value = '' }
async function submitRegistration() { submitError.value = ''; if (!photo.value) { submitError.value = 'Take or upload a profile photograph before submitting.'; return }; if (!form.consent) return; submitting.value = true; try { const body = new FormData(); Object.entries(form).forEach(([key, value]) => body.append(key, value === null ? '' : String(value))); body.append('photo', photo.value); submitted.value = await $fetch('/api/public/existing-student-registrations', { method: 'POST', query: query.value, body }); window.scrollTo({ top: 0, behavior: 'smooth' }) } catch (error: any) { submitError.value = error.data?.statusMessage || error.data?.message || error.message } finally { submitting.value = false } }
onBeforeUnmount(() => { if (photoPreview.value) URL.revokeObjectURL(photoPreview.value) })
</script>
