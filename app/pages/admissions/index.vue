<template>
  <div v-if="pending" class="space-y-4"><USkeleton class="h-32 rounded-2xl" /><USkeleton class="h-96 rounded-2xl" /></div>
  <UAlert v-else-if="loadError" color="error" title="Admission form unavailable" :description="loadError" />
  <div v-else-if="submitted" class="mx-auto max-w-2xl">
    <UCard>
      <div class="text-center">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><UIcon name="i-lucide-check" class="h-7 w-7" /></div>
        <h1 class="mt-5 text-2xl font-semibold">Application submitted</h1>
        <p class="mt-2 text-slate-500">Reference number</p>
        <p class="mt-1 font-mono text-lg font-semibold text-primary">{{ submitted.referenceNumber }}</p>
        <UAlert class="mt-6 text-left" color="warning" title="Admission is pending approval" :description="submitted.physicalCopyInstructions" />
        <UButton class="mt-6" size="lg" icon="i-lucide-download" :href="pdfUrl" external>Download admission form PDF</UButton>
        <p class="mt-4 text-xs text-slate-500">Keep the reference number and PDF for your records. Portal access is provided only after approval by the organization.</p>
      </div>
    </UCard>
  </div>
  <template v-else-if="data">
    <section class="mb-7 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 to-indigo-700 p-6 text-white shadow-lg sm:p-8">
      <div class="flex items-center gap-4">
        <img v-if="data.organization.logo" :src="data.organization.logo" :alt="`${data.organization.name} logo`" class="h-16 w-16 rounded-2xl bg-white object-contain p-2">
        <div><p class="text-sm font-medium text-violet-200">{{ data.organization.name }}</p><h1 class="mt-1 text-2xl font-semibold sm:text-3xl">{{ data.form.title }}</h1></div>
      </div>
      <p class="mt-5 max-w-3xl text-sm leading-6 text-violet-100">{{ data.form.introduction }}</p>
    </section>

    <form class="space-y-6" @submit.prevent="submitApplication">
      <UCard><template #header><h2 class="font-semibold">Program preference</h2></template><div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Dojo / location" required><USelect v-model="form.dojoId" :items="dojoOptions" class="w-full" placeholder="Choose a dojo" required /></UFormField>
        <UFormField label="Program"><USelect v-model="form.programId" :items="programOptions" class="w-full" placeholder="Choose a program (optional)" /></UFormField>
        <UFormField label="Preferred start date"><UInput v-model="form.preferredStartDate" type="date" class="w-full" /></UFormField>
        <UFormField label="Previous training experience" class="sm:col-span-2"><UTextarea v-model="form.previousExperience" class="w-full" :rows="3" /></UFormField>
      </div></UCard>

      <UCard><template #header><h2 class="font-semibold">Student information</h2></template><div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="First name" required><UInput v-model="form.firstName" class="w-full" required /></UFormField>
        <UFormField label="Last name" required><UInput v-model="form.lastName" class="w-full" required /></UFormField>
        <UFormField label="Date of birth" required><UInput v-model="form.dateOfBirth" type="date" :max="today" class="w-full" required /></UFormField>
        <UFormField label="Gender"><USelect v-model="form.gender" :items="genderOptions" class="w-full" placeholder="Optional" /></UFormField>
        <UFormField label="Email" required><UInput v-model="form.email" type="email" class="w-full" required /></UFormField>
        <UFormField label="Phone" required><UInput v-model="form.phone" type="tel" class="w-full" required /></UFormField>
        <UFormField label="Street address" class="sm:col-span-2"><UInput v-model="form.address" class="w-full" /></UFormField>
        <UFormField label="City" help="Filled from the selected dojo"><UInput v-model="form.city" class="w-full" :readonly="Boolean(selectedDojo?.city)" /></UFormField>
        <UFormField label="State / province" help="Filled from the selected dojo"><UInput v-model="form.stateProvince" class="w-full" :readonly="Boolean(selectedDojo?.stateProvince)" /></UFormField>
        <UFormField label="Country" help="Filled from the selected dojo"><UInput v-model="form.country" class="w-full" :readonly="Boolean(selectedDojo?.country)" /></UFormField>
        <UFormField label="Postal / ZIP code"><UInput v-model="form.postalCode" class="w-full" /></UFormField>
      </div></UCard>

      <UCard><template #header><div><h2 class="font-semibold">Profile photograph</h2><p class="mt-1 text-sm text-slate-500">Required. Use a clear, recent, front-facing photograph.</p></div></template>
        <div class="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div class="flex h-40 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950"><img v-if="photoPreview" :src="photoPreview" alt="Profile photograph preview" class="h-full w-full object-cover"><UIcon v-else name="i-lucide-user-round" class="h-12 w-12 text-slate-300" /></div>
          <div><input ref="cameraInput" class="hidden" type="file" accept="image/jpeg,image/png,image/webp" capture="user" @change="choosePhoto"><input ref="uploadInput" class="hidden" type="file" accept="image/jpeg,image/png,image/webp" @change="choosePhoto">
            <div class="flex flex-wrap gap-2"><UButton type="button" icon="i-lucide-camera" @click="cameraInput?.click()">Take picture</UButton><UButton type="button" color="neutral" variant="outline" icon="i-lucide-upload" @click="uploadInput?.click()">Upload photo</UButton></div>
            <p class="mt-3 text-xs text-slate-500">JPG, PNG, or WebP. Maximum 5 MB. The photo will appear on the printed application and student profile after approval.</p>
          </div>
        </div>
      </UCard>

      <UCard><template #header><div><h2 class="font-semibold">Parent or guardian</h2><p class="mt-1 text-sm text-slate-500">Required when the applicant is under 18.</p></div></template><div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Guardian name" :required="isMinor"><UInput v-model="form.guardianName" class="w-full" :required="isMinor" /></UFormField>
        <UFormField label="Relationship" :required="isMinor"><UInput v-model="form.guardianRelationship" class="w-full" :required="isMinor" /></UFormField>
        <UFormField label="Guardian phone" :required="isMinor"><UInput v-model="form.guardianPhone" type="tel" class="w-full" :required="isMinor" /></UFormField>
        <UFormField label="Guardian email"><UInput v-model="form.guardianEmail" type="email" class="w-full" /></UFormField>
      </div></UCard>

      <UCard><template #header><h2 class="font-semibold">Emergency and medical information</h2></template><div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Emergency contact" required><UInput v-model="form.emergencyContact" class="w-full" required /></UFormField>
        <UFormField label="Emergency phone" required><UInput v-model="form.emergencyPhone" type="tel" class="w-full" required /></UFormField>
        <UFormField label="Allergies, medical conditions, or participation limitations" class="sm:col-span-2"><UTextarea v-model="form.medicalNotes" class="w-full" :rows="4" placeholder="Enter none if there is nothing to declare" /></UFormField>
      </div></UCard>

      <UCard><template #header><h2 class="font-semibold">Declaration and consent</h2></template>
        <p class="text-sm leading-6 text-slate-600 dark:text-slate-300">{{ data.form.privacyNotice }}</p><p class="mt-4 text-sm leading-6">{{ data.form.consentText }}</p>
        <UCheckbox v-model="form.consent" class="mt-5" label="I have read and accept this declaration and consent." required />
        <input v-model="form.website" tabindex="-1" autocomplete="off" class="absolute -left-[9999px]" aria-hidden="true">
      </UCard>

      <UAlert v-if="submitError" color="error" title="Could not submit application" :description="submitError" />
      <div class="flex justify-end"><UButton type="submit" size="xl" icon="i-lucide-send" :loading="submitting">Submit admission application</UButton></div>
    </form>
  </template>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admission' })
const route = useRoute()
const query = computed(() => route.query.organization ? { organization: String(route.query.organization) } : undefined)
const { data, pending, error } = await useFetch<any>('/api/public/admissions/form', { query })
const loadError = computed(() => error.value?.data?.statusMessage || error.value?.message || '')
const today = new Date().toISOString().slice(0, 10)
const form = reactive({ dojoId: null as number | null, programId: null as number | null, preferredStartDate: '', previousExperience: '', firstName: '', lastName: '', dateOfBirth: '', gender: undefined as string | undefined, email: '', phone: '', address: '', city: '', stateProvince: '', country: '', postalCode: '', guardianName: '', guardianRelationship: '', guardianPhone: '', guardianEmail: '', emergencyContact: '', emergencyPhone: '', medicalNotes: '', consent: false, website: '' })
const photo = ref<File | null>(null)
const photoPreview = ref('')
const cameraInput = ref<HTMLInputElement | null>(null)
const uploadInput = ref<HTMLInputElement | null>(null)
const submitting = ref(false)
const submitError = ref('')
const submitted = ref<any>(null)
const shortDayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const parseBatchTime = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value)
  if (!match) return null
  const hour = Number(match[1])
  return { time: `${hour % 12 || 12}:${match[2]}`, period: hour < 12 ? 'am' : 'pm' }
}
const formatBatchTimeRange = (startValue: string, endValue: string) => {
  const start = parseBatchTime(startValue)
  const end = parseBatchTime(endValue)
  if (!start || !end) return `${startValue} to ${endValue}`
  return `${start.time}${start.period === end.period ? '' : ` ${start.period}`} to ${end.time} ${end.period}`
}
const formatBatchSchedules = (schedules: any[]) => {
  const groups = new Map<string, { days: string[], startTime: string, endTime: string }>()
  for (const schedule of schedules) {
    const key = `${schedule.startTime}-${schedule.endTime}`
    const group: { days: string[], startTime: string, endTime: string } = groups.get(key) || { days: [], startTime: schedule.startTime, endTime: schedule.endTime }
    group.days.push(shortDayNames[schedule.dayOfWeek] || '')
    groups.set(key, group)
  }
  return [...groups.values()]
    .map(group => `${group.days.filter(Boolean).join('-')} ${formatBatchTimeRange(group.startTime, group.endTime)}`.trim())
    .join(', ')
}
const dojoOptions = computed(() => (data.value?.dojos || []).map((dojo: any) => {
  const location = `${dojo.name}${dojo.city ? ` — ${dojo.city}` : ''}`
  const batchTimings = formatBatchSchedules(dojo.schedules || [])
  return { label: `${location}${batchTimings ? ` · ${batchTimings}` : ''}`, value: dojo.id }
}))
const selectedDojo = computed(() => (data.value?.dojos || []).find((dojo: any) => dojo.id === form.dojoId))
watch(selectedDojo, (dojo) => {
  form.city = dojo?.city || ''
  form.stateProvince = dojo?.stateProvince || ''
  form.country = dojo?.country || ''
})
const programOptions = computed(() => (data.value?.programs || []).map((program: any) => ({ label: program.displayName, value: program.id })))
const genderOptions = [{ label: 'Male', value: 'male' }, { label: 'Female', value: 'female' }, { label: 'Other', value: 'other' }]
const isMinor = computed(() => { if (!form.dateOfBirth) return false; const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 18); return new Date(`${form.dateOfBirth}T00:00:00`) > cutoff })
const pdfUrl = computed(() => submitted.value ? `/api/public/admissions/${encodeURIComponent(submitted.value.token)}/pdf` : '')

function choosePhoto(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { submitError.value = 'Choose a JPG, PNG, or WebP photograph up to 5 MB.'; input.value = ''; return }
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
  photo.value = file
  photoPreview.value = URL.createObjectURL(file)
  submitError.value = ''
}

async function submitApplication() {
  submitError.value = ''
  if (!photo.value) { submitError.value = 'Take or upload a profile photograph before submitting.'; return }
  if (!form.consent) { submitError.value = 'Accept the declaration and consent before submitting.'; return }
  submitting.value = true
  try {
    const body = new FormData()
    Object.entries(form).forEach(([key, value]) => body.append(key, value === null ? '' : String(value)))
    body.append('photo', photo.value)
    submitted.value = await $fetch('/api/public/admissions', { method: 'POST', query: query.value, body })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (error: any) { submitError.value = error.data?.statusMessage || error.data?.message || error.message || 'Please check the form and try again.' } finally { submitting.value = false }
}

onBeforeUnmount(() => { if (photoPreview.value) URL.revokeObjectURL(photoPreview.value) })
</script>
