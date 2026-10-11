<template>
  <div>
    <UCard v-if="pending"><USkeleton class="h-96" /></UCard>
    <UAlert v-else-if="error" color="error" title="Registration form unavailable" :description="error.data?.statusMessage || 'Check that this event is open and the link is correct.'" />
    <UCard v-else-if="submitted" class="mx-auto max-w-2xl text-center">
      <UIcon name="i-lucide-circle-check" class="mx-auto h-14 w-14 text-emerald-500" />
      <h1 class="mt-4 text-2xl font-semibold">Registration received</h1>
      <p class="mt-3 text-slate-600 dark:text-slate-300">{{ settings.confirmationMessage || 'The event team will review your details and availability. Your place is reserved only after a booking is approved; the team will contact you about confirmation and payment.' }}</p>
      <div class="mx-auto mt-5 max-w-sm rounded-xl bg-slate-100 p-4 dark:bg-slate-800"><p class="text-xs uppercase text-slate-500">Keep this reference number</p><p class="mt-1 font-mono font-semibold">{{ submitted.reference }}</p></div>
      <UButton v-if="submitted.printToken" :href="`/api/public/event-registration-print/${submitted.printToken}`" external size="lg" icon="i-lucide-printer" class="mt-5">Download printable registration</UButton>
      <UAlert v-if="submitted.physicalCopyInstructions" class="mt-5 text-left" color="warning" title="Sign and submit the printed copy" :description="submitted.physicalCopyInstructions" />
    </UCard>
    <template v-else-if="data">
      <section class="mb-7 overflow-hidden rounded-2xl p-6 text-white shadow-lg sm:p-8" :style="{ background: `linear-gradient(135deg, color-mix(in srgb, ${settings.accentColor}, black 60%), #064e3b)` }">
        <div class="flex items-center gap-4"><img v-if="data.organization.logo" :src="data.organization.logo" :alt="`${data.organization.name} logo`" class="h-16 w-16 rounded-2xl bg-white object-contain p-2"><div><p class="text-sm text-teal-100">{{ data.organization.name }}</p><h1 class="mt-1 text-2xl font-semibold sm:text-3xl">{{ settings.title || `${data.event.name} registration` }}</h1></div></div>
        <p class="mt-4 text-sm text-teal-50">{{ data.event.startDate }} – {{ data.event.endDate }} · {{ data.event.venue }}</p>
        <p v-if="data.event.description" class="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-teal-50">{{ data.event.description }}</p>
        <p class="mt-3 whitespace-pre-wrap text-sm font-medium">{{ settings.introduction || 'No login is required. You can register the student alone or with up to two accompanying parents.' }}</p>
        <a :href="`/api/public/events/${encodeURIComponent(token)}/branded-invitation`" class="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-teal-800" download><UIcon name="i-lucide-file-down" />Download branded invitation (PDF)</a>
        <a v-if="data.event.invitationFilename" :href="`/api/public/events/${encodeURIComponent(token)}/invitation`" class="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-teal-800" download><UIcon name="i-lucide-file-down" />Download invitation letter (PDF)</a>
      </section>
      <form class="event-public-form space-y-6" @submit.prevent="submit">
        <UCard><template #header><h2 class="font-semibold">Student and contact</h2></template><div class="grid gap-4 sm:grid-cols-2">
          <label>Student full name<input v-model="student.name" required maxlength="250" autocomplete="name"></label>
          <template v-if="data.event.registrationMode === 'public'"><label>Club, school or dojo (optional)<input v-model="form.sourceDojoName" maxlength="250" placeholder="Leave blank if independent"></label><label>City<input v-model="form.sourceCity" required maxlength="150"></label><label>State / province<input v-model="form.sourceState" required maxlength="150"></label><label>Instructor name<input v-model="form.instructorName" required maxlength="250"></label><label>Country (optional)<input v-model="form.sourceCountry" maxlength="150"></label></template>
          <template v-else><label>Where does the student train?<select v-model="form.sourceType"><option value="internal">With this organization</option><option value="external">Another dojo, state or organization</option></select></label><label v-if="form.sourceType === 'internal'">Current dojo<select v-model.number="form.dojoId" required><option :value="null" disabled>Select dojo</option><option v-for="dojo in data.dojos" :key="dojo.id" :value="dojo.id">{{ dojo.name }}{{ dojo.city ? ` — ${dojo.city}` : '' }}</option></select></label><template v-else><label>Dojo, school or organization<input v-model="form.sourceDojoName" required maxlength="250" placeholder="Independent if none"></label><label>State / province<input v-model="form.sourceState" required maxlength="150"></label><label>Country<input v-model="form.sourceCountry" required maxlength="150"></label></template></template>
          <label>Student date of birth<input v-model="form.dateOfBirth" type="date" :max="today" required></label>
          <label>Membership number, if known<input v-model="form.membershipNumber" maxlength="100"></label>
          <label>Contact adult name<input v-model="form.contactName" required maxlength="250" autocomplete="name"></label>
          <label>Reachable phone<input v-model="form.contactPhone" type="tel" required minlength="5" maxlength="60" autocomplete="tel"></label>
          <label>Emergency contact name<input v-model="form.emergencyName" maxlength="250"></label>
          <label>Emergency phone<input v-model="form.emergencyPhone" type="tel" maxlength="60"></label>
        </div><p class="mt-4 text-xs text-slate-500">Anyone may apply. This registration stays within the event and does not create a dojo student profile or require an account.</p></UCard>
        <UCard><template #header><h2 class="font-semibold">Student photograph</h2></template><div class="flex flex-col gap-4 sm:flex-row sm:items-center"><div class="flex h-40 w-32 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed"><img v-if="photoPreview" :src="photoPreview" alt="Student photo preview" class="h-full w-full object-cover"><UIcon v-else name="i-lucide-user-round" class="h-12 w-12 text-slate-300" /></div><div><input ref="cameraInput" class="hidden" type="file" accept="image/jpeg,image/png,image/webp" capture="user" @change="choosePhoto"><input ref="uploadInput" class="hidden" type="file" accept="image/jpeg,image/png,image/webp" @change="choosePhoto"><div class="flex flex-wrap gap-2"><UButton type="button" icon="i-lucide-camera" @click="cameraInput?.click()">Take a photo</UButton><UButton type="button" variant="outline" icon="i-lucide-upload" @click="uploadInput?.click()">Upload photo</UButton></div><p class="mt-2 text-xs text-slate-500">JPG, PNG, or WebP, up to 5 MB. {{ settings.requirePhoto ? 'Required.' : 'Optional.' }} The photo appears on the printed form.</p></div></div></UCard>
        <UCard><template #header><h2 class="font-semibold">Who is coming?</h2></template>
          <label class="block max-w-xs">Accompanying parents<select v-model.number="parentCount" @change="setParents"><option :value="0">Student only</option><option :value="1">Student and one parent</option><option :value="2">Student and two parents</option></select></label>
          <p v-if="!data.event.transportProvided" class="mt-3 text-sm text-slate-600 dark:text-slate-300">Travel to and from this event is arranged by students and parents. The organizer does not provide transport.</p>
          <fieldset v-for="(person, index) in form.attendees" :key="index" class="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-800"><legend class="px-2 font-semibold">{{ index ? `Parent ${index}` : 'Student' }}</legend>
            <div class="grid gap-4 sm:grid-cols-2">
              <label v-if="index">Parent full name<input v-model="person.name" maxlength="250" placeholder="Can be completed later"></label>
              <label v-if="index">Relationship<input v-model="person.relationship" maxlength="100" placeholder="Mother, father, guardian…"></label>
              <label v-if="index">Parent phone<input v-model="person.phone" type="tel" maxlength="60"></label>
              <label v-if="index">Parent email<input v-model="person.email" type="email" maxlength="250"></label>
              <label>Meal preference<input v-model="person.meal" maxlength="100" placeholder="Vegetarian, regular, allergy…"></label>
              <label class="sm:col-span-2">Medical, dietary or accessibility needs<textarea v-model="person.medicalNotes" rows="2" maxlength="2000" placeholder="Only information the event team needs" /></label>
            </div>
            <div class="mt-4 flex flex-wrap gap-4 text-sm"><label v-if="data.event.transportProvided" class="flex items-center gap-2"><input v-model="person.transportOut" type="checkbox">Outward transport</label><label v-if="data.event.transportProvided" class="flex items-center gap-2"><input v-model="person.transportReturn" type="checkbox">Return transport</label><label class="flex items-center gap-2"><input v-model="person.accommodation" type="checkbox">Accommodation</label></div>
          </fieldset>
        </UCard>
        <UCard v-if="settings.questions.length"><template #header><h2 class="font-semibold">Additional event questions</h2></template><div class="grid gap-4 sm:grid-cols-2"><div v-for="question in settings.questions" :key="question.id" :class="question.type === 'textarea' ? 'sm:col-span-2' : ''"><label v-if="question.type === 'checkbox'" class="flex items-center gap-2"><input v-model="form.customAnswers[question.id]" type="checkbox" :required="question.required">{{ question.label }}</label><label v-else>{{ question.label }}<textarea v-if="question.type === 'textarea'" v-model="form.customAnswers[question.id]" rows="3" :required="question.required" maxlength="3000" /><select v-else-if="question.type === 'select'" v-model="form.customAnswers[question.id]" :required="question.required"><option value="">Select an option</option><option v-for="option in question.options" :key="option" :value="option">{{ option }}</option></select><input v-else v-model="form.customAnswers[question.id]" :type="question.type" :required="question.required" :maxlength="question.type === 'text' ? 500 : undefined"></label><p v-if="question.help" class="mt-1 text-xs text-slate-500">{{ question.help }}</p></div></div></UCard>
        <UCard><template #header><h2 class="font-semibold">Price and consent</h2></template>
          <div class="rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm"><div class="flex justify-between"><span>Subtotal</span><strong>{{ formatMinor(quote.subtotal) }}</strong></div><div class="mt-2 flex justify-between"><span>Tax</span><span>{{ formatMinor(quote.tax) }}</span></div><div class="mt-3 flex justify-between border-t border-primary/20 pt-3 font-semibold"><span>Estimated total</span><span>{{ formatMinor(quote.total) }}</span></div><p v-if="data.event.confirmationRule === 'deposit'" class="mt-2">Confirmation deposit: {{ formatMinor(Math.min(data.event.deposit, quote.total)) }} per booking.</p><p class="mt-2 text-slate-500">The team will confirm your booking and payment instructions after review. Optional services are charged per person when selected.</p></div>
          <p v-if="settings.privacyNotice" class="mt-5 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{{ settings.privacyNotice }}</p>
          <p class="mt-5 max-h-56 overflow-auto whitespace-pre-wrap text-sm">{{ data.event.terms }}</p>
          <div class="mt-5 grid gap-4 sm:grid-cols-2"><label>Consenting adult name<input v-model="form.consent.name" required maxlength="250"></label><label>Consenting adult phone<input v-model="form.consent.phone" type="tel" required minlength="5" maxlength="60"></label></div>
          <label class="mt-4 flex items-start gap-2"><input v-model="form.consent.accepted" type="checkbox" required><span>I am the student if an adult, or an authorized parent/guardian, and I accept these participation and cancellation terms.</span></label>
          <label class="mt-4 flex items-start gap-2"><input v-model="form.waitlist" type="checkbox"><span>Place my request on the waiting list instead of reserving a place.</span></label>
          <label class="mt-4 block">Anything else the event team should know?<textarea v-model="form.notes" rows="2" maxlength="3000" /></label>
          <input v-model="form.website" tabindex="-1" autocomplete="off" class="absolute left-[-9999px]" aria-hidden="true">
        </UCard>
        <UAlert v-if="submitError" color="error" title="Could not submit registration" :description="submitError" />
        <div class="flex justify-end"><UButton type="submit" size="xl" icon="i-lucide-send" :loading="submitting">{{ settings.submitLabel }}</UButton></div>
      </form>
    </template>
  </div>
</template>
<script setup lang="ts">
import { eventCharge } from '#shared/utils/event-finance'
import { defaultEventFormSettings } from '#shared/types/events'
definePageMeta({ layout: 'admission' })
const route = useRoute()
const token = String(route.params.token)
const { data, pending, error } = await useFetch<any>(`/api/public/events/${encodeURIComponent(token)}/form`)
const settings = computed(() => data.value?.event.formSettings || defaultEventFormSettings)
const today = new Date().toISOString().slice(0, 10)
const blankPerson = (type: 'student' | 'parent') => ({ type, name: '', relationship: '', phone: '', email: '', meal: '', medicalNotes: '', transportOut: false, transportReturn: false, accommodation: false, room: '', busOut: '', busReturn: '' })
const form = reactive({ requestKey: crypto.randomUUID(), sourceType: 'external', dojoId: null as number | null, sourceDojoName: '', sourceCity: '', sourceState: '', sourceCountry: '', instructorName: '', dateOfBirth: '', membershipNumber: '', attendees: [blankPerson('student')], contactName: '', contactPhone: '', emergencyName: '', emergencyPhone: '', consent: { name: '', phone: '', accepted: false }, notes: '', waitlist: false, website: '', customAnswers: {} as Record<string, string | boolean> })
const student = computed(() => form.attendees[0]!)
const parentCount = ref(0)
function setParents() { while (form.attendees.length < parentCount.value + 1) form.attendees.push(blankPerson('parent')); form.attendees.splice(parentCount.value + 1) }
const { formatMinor } = useMoney(() => data.value?.event.currency)
const quote = computed(() => data.value ? eventCharge(form.attendees, data.value.event.prices) : { subtotal: 0, tax: 0, total: 0 })
const submitting = ref(false); const submitError = ref(''); const submitted = ref<any>(null)
const cameraInput = ref<HTMLInputElement | null>(null); const uploadInput = ref<HTMLInputElement | null>(null)
const photo = ref<File | null>(null); const photoPreview = ref<string | null>(null)
function choosePhoto(event: Event) { const selected = (event.target as HTMLInputElement).files?.[0]; if (!selected) return; if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 5 * 1024 * 1024) { submitError.value = 'Use a JPG, PNG, or WebP photo up to 5 MB.'; return }; if (photoPreview.value) URL.revokeObjectURL(photoPreview.value); photo.value = selected; photoPreview.value = URL.createObjectURL(selected); submitError.value = '' }
onBeforeUnmount(() => { if (photoPreview.value) URL.revokeObjectURL(photoPreview.value) })
async function submit() {
  submitError.value = ''; if (settings.value.requirePhoto && !photo.value) { submitError.value = 'Take or upload a student photograph before submitting.'; return }; submitting.value = true
  try { const body = new FormData(); body.append('registration', JSON.stringify(form)); if (photo.value) body.append('photo', photo.value); submitted.value = await $fetch(`/api/public/events/${encodeURIComponent(token)}`, { method: 'POST', body }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  catch (err: any) { submitError.value = err.data?.statusMessage || err.data?.message || err.message }
  finally { submitting.value = false }
}
</script>
<style scoped>
.event-public-form label { font-size: .875rem; font-weight: 500; }
.event-public-form input:not([type=checkbox]), .event-public-form select, .event-public-form textarea { display:block; width:100%; margin-top:.4rem; padding:.6rem .75rem; border:1px solid var(--ui-border); border-radius:.5rem; background:var(--ui-bg); color:var(--ui-text); font-weight:400; }
</style>
