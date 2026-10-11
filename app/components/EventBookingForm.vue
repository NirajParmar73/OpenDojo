<template>
  <UCard>
    <template #header><div class="flex items-center justify-between gap-3"><h3 class="font-semibold">{{ initial ? `Edit ${initial.reference}` : 'Register for this event' }}</h3><UButton color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Close registration" @click="$emit('cancel')" /></div></template>
    <form class="booking-form space-y-5" @submit.prevent="save">
      <UAlert v-if="error" color="error" :title="error" />
      <p class="text-sm text-slate-500">Parents can be entered here without an account or an existing guardian record. Missing names can be completed later; the booking remains provisional until all required details and consent are supplied.</p>
      <label v-if="!initial" class="block">Student<select v-model.number="form.studentId" required @change="setStudent"><option :value="0" disabled>Select student</option><option v-for="student in students" :key="student.id" :value="student.id">{{ student.name }}</option></select></label>
      <label class="block">Who is attending?<select v-model.number="parentCount" @change="setParents"><option :value="0">Student only</option><option :value="1">Student + one parent / guardian</option><option :value="2">Student + two parents / guardians</option></select></label>
      <fieldset v-for="(person, index) in form.attendees" :key="person.id || index" class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <legend class="px-2 font-semibold">{{ person.type === 'student' ? 'Student' : `Accompanying adult ${index}` }}</legend>
        <label v-if="person.type === 'parent' && selectedStudent?.guardians?.length" class="mb-4 block">Use saved guardian<select :value="''" @change="chooseGuardian(person, ($event.target as HTMLSelectElement).value)"><option value="">Enter details or choose a saved guardian</option><option v-for="guardian in selectedStudent.guardians" :key="guardian.id" :value="guardian.id">{{ guardian.name }} ({{ guardian.relationship }})</option></select></label>
        <div class="grid gap-4 sm:grid-cols-2">
          <label>Full name<input v-model="person.name" :disabled="person.type === 'student' && Boolean(form.studentId)" maxlength="250" :placeholder="person.type === 'parent' ? 'Leave blank if not yet known' : ''"></label>
          <label v-if="person.type === 'parent'">Relationship<select v-model="person.relationship"><option value="">Not yet known</option><option v-if="person.relationship && !['Mother', 'Father', 'Guardian', 'Grandparent', 'Other'].includes(person.relationship)" :value="person.relationship">{{ person.relationship }}</option><option v-for="relationship in ['Mother', 'Father', 'Guardian', 'Grandparent', 'Other']" :key="relationship">{{ relationship }}</option></select></label>
          <label>Phone<input v-model="person.phone" type="tel" maxlength="60"></label>
          <label v-if="person.type === 'parent'">Email (optional)<input v-model="person.email" type="email" maxlength="250"></label>
          <label>Meal preference<select v-model="person.meal"><option value="">Not yet known</option><option v-for="meal in ['Vegetarian', 'Non-vegetarian', 'Jain', 'Vegan', 'Other']" :key="meal">{{ meal }}</option></select></label>
          <label class="sm:col-span-2">Allergies, dietary or medical requirements<textarea v-model="person.medicalNotes" rows="2" maxlength="2000" placeholder="Only information needed by the event team" /></label>
        </div>
        <div class="mt-4 flex flex-wrap gap-4"><label class="flex items-center gap-2"><input v-model="person.transportOut" type="checkbox">Outward transport</label><label class="flex items-center gap-2"><input v-model="person.transportReturn" type="checkbox">Return transport</label><label class="flex items-center gap-2"><input v-model="person.accommodation" type="checkbox">Accommodation</label></div>
        <div v-if="!portal" class="mt-4 grid gap-3 sm:grid-cols-3"><label>Room / group<input v-model="person.room" maxlength="100"></label><label>Outward bus / pickup<input v-model="person.busOut" maxlength="100"></label><label>Return bus / pickup<input v-model="person.busReturn" maxlength="100"></label></div>
      </fieldset>
      <fieldset v-if="initial?.guestProfile && canManage" class="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><legend class="font-semibold">Participant background</legend><div class="grid gap-3 sm:grid-cols-2"><label>Club / school (optional)<input v-model="form.guestProfile.dojoName" :required="event.registrationMode === 'linked'" maxlength="250"></label><label v-if="event.registrationMode === 'public'">City<input v-model="form.guestProfile.city" required maxlength="150"></label><label>State / province<input v-model="form.guestProfile.state" required maxlength="150"></label><label v-if="event.registrationMode === 'public'">Instructor name<input v-model="form.guestProfile.instructorName" required maxlength="250"></label><label>Country (optional)<input v-model="form.guestProfile.country" :required="event.registrationMode === 'linked'" maxlength="150"></label><label>Date of birth<input v-model="form.guestProfile.dateOfBirth" type="date" required></label><label>Membership number<input v-model="form.guestProfile.membershipNumber" maxlength="100"></label></div></fieldset>
      <div class="grid gap-4 sm:grid-cols-2"><label>Booking contact name<input v-model="form.contactName" maxlength="250"></label><label>Reachable contact phone<input v-model="form.contactPhone" type="tel" maxlength="60"></label><label>Emergency contact name<input v-model="form.emergencyName" maxlength="250"></label><label>Emergency phone<input v-model="form.emergencyPhone" type="tel" maxlength="60"></label></div>
      <fieldset class="rounded-xl bg-slate-50 p-4 dark:bg-slate-950"><legend class="font-semibold">Participation consent</legend><p class="my-3 max-h-56 overflow-auto whitespace-pre-wrap text-sm">{{ initial?.consent?.terms || event.terms || 'Contact the organizer for participation terms.' }}</p><div class="grid gap-4 sm:grid-cols-2"><label>Consenting adult name<input v-model="form.consent.name" maxlength="250" placeholder="Parent/guardian for a minor; self for an adult"></label><label>Consenting adult phone<input v-model="form.consent.phone" type="tel" maxlength="60"></label></div><label class="mt-4 flex items-start gap-2"><input v-model="form.consent.accepted" type="checkbox" class="mt-1"><span>{{ portal ? 'I am the adult participant or authorized parent/guardian, and I accept these participation and cancellation terms.' : 'The adult participant or authorized parent/guardian has supplied consent to these terms.' }}</span></label></fieldset>
      <label v-if="parentCount && form.studentId" class="flex items-start gap-2"><input v-model="form.saveGuardians" type="checkbox" class="mt-1">Save these accompanying adults as guardians on this student’s profile for future use.</label>
      <label class="block">Booking notes<textarea v-model="form.notes" maxlength="3000" rows="2" /></label>
      <label v-if="canManage" class="block">Discount before tax ({{ event.currency }})<input v-model.number="discount" type="number" min="0" step="0.01"></label>
      <div class="rounded-xl border border-primary/25 bg-primary/5 p-4"><div class="flex justify-between gap-3"><span>{{ form.attendees.length }} attendees · subtotal</span><strong>{{ formatMinor(quote.subtotal) }}</strong></div><div v-if="quote.discount" class="mt-2 flex justify-between"><span>Discount</span><span>−{{ formatMinor(quote.discount) }}</span></div><div class="mt-2 flex justify-between"><span>Tax</span><span>{{ formatMinor(quote.tax) }}</span></div><div class="mt-3 flex justify-between border-t border-primary/20 pt-3 font-semibold"><span>Booking total</span><span>{{ formatMinor(quote.total) }}</span></div><p v-if="event.confirmationRule === 'deposit'" class="mt-3 text-sm">Confirmation deposit: {{ formatMinor(Math.min(event.deposit, quote.total)) }} per booking.</p></div>
      <label v-if="!initial" class="flex items-start gap-2"><input v-model="form.waitlist" type="checkbox" class="mt-1">Join the waiting list only (no reserved places or payment due until promoted).</label>
      <div class="flex gap-3"><UButton type="submit" :loading="saving" :disabled="!initial && !form.studentId">{{ initial ? 'Save booking details' : 'Submit registration' }}</UButton><UButton color="neutral" variant="ghost" @click="$emit('cancel')">Cancel</UButton></div>
    </form>
  </UCard>
</template>
<script setup lang="ts">
import { eventCharge } from '#shared/utils/event-finance'
const props = defineProps<{ event: any, students: any[], initial?: any, portal: boolean, canManage: boolean, endpoint: string }>()
const emit = defineEmits(['saved', 'cancel'])
const blankPerson = (type: string) => ({ type, name: '', relationship: '', phone: '', email: '', meal: '', medicalNotes: '', transportOut: false, transportReturn: false, accommodation: false, room: '', busOut: '', busReturn: '' })
const form = reactive<any>(props.initial ? { ...JSON.parse(JSON.stringify(props.initial)), saveGuardians: false } : { studentId: props.portal ? props.students[0]?.id || 0 : 0, requestKey: crypto.randomUUID(), attendees: [blankPerson('student')], contactName: '', contactPhone: '', emergencyName: '', emergencyPhone: '', consent: { name: '', phone: '', accepted: false }, notes: '', saveGuardians: false, waitlist: false })
const selectedStudent = computed(() => props.students.find(student => student.id === form.studentId))
const parentCount = ref(form.attendees.length - 1)
const discount = ref((props.initial?.discount || 0) / 100)
const { formatMinor } = useMoney(() => props.event.currency)
const quote = computed(() => eventCharge(form.attendees, props.initial?.prices || props.event.prices, Math.round(Number(discount.value) * 100)))
function setStudent() { const student = selectedStudent.value; if (!student) return; form.attendees[0].name = student.name; form.attendees[0].phone = student.phone; form.emergencyName = student.emergencyContact; form.emergencyPhone = student.emergencyPhone }
if (!props.initial) setStudent()
function setParents() { while (form.attendees.length < parentCount.value + 1) form.attendees.push(blankPerson('parent')); form.attendees.splice(parentCount.value + 1) }
function chooseGuardian(person: any, id: string) { const guardian = selectedStudent.value?.guardians.find((item: any) => item.id === Number(id)); if (guardian) Object.assign(person, { name: guardian.name, relationship: guardian.relationship, phone: guardian.phone, email: guardian.email }) }
const saving = ref(false); const error = ref('')
async function save() {
  saving.value = true; error.value = ''
  try {
    const body = { ...form, ...(props.canManage ? { discount: Math.round(Number(discount.value) * 100) } : {}) }
    // Portal and registering instructors can edit details, never financial/status fields.
    if (props.initial) { delete body.status; delete body.cancellationFee; if (!props.canManage) delete body.discount }
    if (!props.canManage || !body.guestProfile) delete body.guestProfile
    const result = await $fetch<any>(props.initial ? `${props.endpoint}/bookings/${props.initial.id}` : `${props.endpoint}/bookings`, { method: props.initial ? 'PATCH' : 'POST', body })
    emit('saved', result)
  } catch (err: any) { error.value = err.data?.statusMessage || err.message } finally { saving.value = false }
}
</script>
<style scoped>
.booking-form label { font-size:.875rem; font-weight:500; }
.booking-form input:not([type=checkbox]), .booking-form select, .booking-form textarea { display:block; width:100%; margin-top:.4rem; padding:.6rem .75rem; border:1px solid var(--ui-border); border-radius:.5rem; background:var(--ui-bg); color:var(--ui-text); font-weight:400; }
</style>
