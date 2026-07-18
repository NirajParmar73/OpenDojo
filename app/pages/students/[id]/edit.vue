<template>
  <div class="mx-auto max-w-3xl">
    <div class="mb-6 flex items-center justify-between gap-4">
      <div>
        <UButton :to="`/students/${studentId}`" color="neutral" variant="ghost" icon="i-lucide-arrow-left">Student profile</UButton>
        <h2 class="mt-3 text-2xl font-semibold tracking-tight">Edit student</h2>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Keep the student’s core record accurate.</p>
      </div>
    </div>

    <UCard v-if="pending"><div class="space-y-4"><USkeleton class="h-10" /><USkeleton class="h-10" /><USkeleton class="h-10" /></div></UCard>
    <UAlert v-else-if="error" color="error" title="Unable to load student" :description="error.message" />
    <UCard v-else>
      <form class="grid gap-5 md:grid-cols-2" @submit.prevent="save">
        <UFormField label="First name" required><UInput v-model="form.firstName" required /></UFormField>
        <UFormField label="Last name" required><UInput v-model="form.lastName" required /></UFormField>
        <UFormField label="Dojo"><USelect v-model="form.dojoId" :items="dojoOptions" placeholder="No dojo assigned" /></UFormField>
        <UFormField label="Status"><USelect v-model="form.status" :items="statusOptions" /></UFormField>
        <UFormField label="Email"><UInput v-model="form.email" type="email" /></UFormField>
        <UFormField label="Phone"><UInput v-model="form.phone" /></UFormField>
        <UFormField label="Date of birth"><UInput v-model="form.dateOfBirth" type="date" /></UFormField>
        <UFormField label="Date joined" required><UInput v-model="form.joinedAt" type="date" required /></UFormField>
        <UFormField label="Gender"><USelect v-model="form.gender" :items="genderOptions" placeholder="Not specified" /></UFormField>
        <UFormField label="Profile photo">
          <div class="flex items-center gap-3">
            <img v-if="student?.avatar" :src="student.avatar" alt="Student profile photo" class="h-12 w-12 rounded-full object-cover" />
            <input ref="studentCameraInput" type="file" accept="image/jpeg,image/png,image/gif,image/webp" capture="environment" class="hidden" @change="uploadAvatar" />
            <input ref="studentGalleryInput" type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="hidden" @change="uploadAvatar" />
            <UButton type="button" size="sm" color="neutral" variant="soft" icon="i-lucide-camera" @click="studentCameraInput?.click()">Take photo</UButton>
            <UButton type="button" size="sm" color="neutral" variant="soft" icon="i-lucide-image" @click="studentGalleryInput?.click()">Choose photo</UButton>
          </div>
        </UFormField>
        <UFormField label="Address" class="md:col-span-2"><UInput v-model="form.address" /></UFormField>
        <UFormField label="Country"><UInput v-model="form.country" /></UFormField>
        <UFormField label="Country code"><UInput v-model="form.countryCode" maxlength="2" placeholder="IN" /></UFormField>
        <UFormField label="State / province"><UInput v-model="form.stateProvince" /></UFormField>
        <UFormField label="City"><UInput v-model="form.city" /></UFormField>
        <UFormField label="ZIP / PIN code"><UInput v-model="form.postalCode" /></UFormField>
        <UFormField label="Emergency contact"><UInput v-model="form.emergencyContact" /></UFormField>
        <UFormField label="Emergency phone"><UInput v-model="form.emergencyPhone" /></UFormField>
        <UFormField label="Medical notes" class="md:col-span-2"><UTextarea v-model="form.medicalNotes" :rows="3" /></UFormField>
        <div class="flex justify-end gap-3 pt-2 md:col-span-2"><UButton :to="`/students/${studentId}`" color="neutral" variant="ghost">Cancel</UButton><UButton type="submit" color="primary" :loading="saving">Save changes</UButton></div>
      </form>
    </UCard>

    <UCard v-if="!pending && !error" class="mt-6">
      <template #header><div><h3 class="font-semibold">Fee setup</h3><p class="mt-1 text-sm text-slate-500">Assign a new fee plan or recurring discount. Existing terms remain in the student profile history.</p></div></template>
      <form class="grid gap-4 md:grid-cols-2" @submit.prevent="assignFeePlan"><UFormField label="Fee plan" required><USelect v-model="feeForm.feePlanId" :items="feePlanOptions" placeholder="Select a fee plan" required /></UFormField><UFormField label="Effective date" required><UInput v-model="feeForm.startDate" type="date" required /></UFormField><UFormField label="Recurring discount"><UInput v-model.number="feeForm.discount" type="number" min="0" step="0.01" placeholder="0.00" /></UFormField><UFormField label="Discount reason" :required="feeForm.discount > 0"><UInput v-model="feeForm.discountReason" placeholder="Required for a discount" /></UFormField><div class="md:col-span-2"><UButton type="submit" color="primary" :loading="savingFee">Assign fee plan</UButton></div></form>
    </UCard>

    <UCard v-if="!pending && !error && ['owner', 'admin'].includes(user?.role || '')" class="mt-6">
      <template #header><div><h3 class="font-semibold">Portal access</h3><p class="mt-1 text-sm text-slate-500">Create or reset credentials to share privately with the student. An email address is not required.</p></div></template>
      <form class="grid gap-4 md:grid-cols-2" @submit.prevent="savePortalAccess"><UFormField label="Portal username" required><UInput v-model="portalForm.username" placeholder="e.g. akshay.patel" required /></UFormField><UFormField label="Temporary password" required><UInput v-model="portalForm.temporaryPassword" type="password" placeholder="At least 8 characters" required /></UFormField><UCheckbox v-model="portalForm.isActive" label="Portal access is active" class="md:col-span-2" /><div class="md:col-span-2"><UButton type="submit" color="primary" :loading="savingPortal">Save portal access</UButton></div></form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { user } = useUserSession()
const studentId = Number(route.params.id)
const saving = ref(false)
const savingFee = ref(false)
const savingPortal = ref(false)
const studentCameraInput = ref<HTMLInputElement | null>(null)
const studentGalleryInput = ref<HTMLInputElement | null>(null)
const form = reactive({ firstName: '', lastName: '', dojoId: null as number | null, status: 'active', email: '', phone: '', dateOfBirth: '', joinedAt: '', gender: undefined as string | undefined, address: '', city: '', stateProvince: '', country: '', countryCode: '', postalCode: '', emergencyContact: '', emergencyPhone: '', medicalNotes: '' })
const statusOptions = [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }, { label: 'Archived', value: 'archived' }]
const genderOptions = [{ label: 'Male', value: 'male' }, { label: 'Female', value: 'female' }, { label: 'Other', value: 'other' }]

const { data: student, pending, error } = await useFetch<any>(`/api/students/${studentId}`)
const { data: dojos } = await useFetch<any[]>('/api/dojos')
const { data: feePlans } = await useFetch<any[]>('/api/fee-plans')
const dojoOptions = computed(() => (dojos.value || []).map(dojo => ({ label: dojo.name, value: dojo.id })))
const feePlanOptions = computed(() => (feePlans.value || []).filter(plan => !plan.dojoId || plan.dojoId === form.dojoId).map(plan => ({ label: plan.name, value: plan.id })))
const feeForm = reactive({ feePlanId: null as number | null, startDate: new Date().toISOString().slice(0, 10), discount: 0, discountReason: '' })
const portalForm = reactive({ username: '', temporaryPassword: '', isActive: true })

watchEffect(() => {
  if (!student.value) return
  Object.assign(form, {
    firstName: student.value.firstName,
    lastName: student.value.lastName,
    dojoId: student.value.dojoId || null,
    status: student.value.status || 'active',
    email: student.value.email || '',
    phone: student.value.phone || '',
    dateOfBirth: student.value.dateOfBirth ? new Date(student.value.dateOfBirth).toISOString().slice(0, 10) : '',
    joinedAt: student.value.joinedAt ? new Date(student.value.joinedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    gender: student.value.gender || undefined,
    address: student.value.address || '',
    city: student.value.city || '',
    stateProvince: student.value.stateProvince || '',
    country: student.value.country || '',
    countryCode: student.value.countryCode || '',
    postalCode: student.value.postalCode || '',
    emergencyContact: student.value.emergencyContact || '',
    emergencyPhone: student.value.emergencyPhone || '',
    medicalNotes: student.value.medicalNotes || '',
  })
})

async function assignFeePlan() {
  if (!feeForm.feePlanId) return
  if (feeForm.discount > 0 && !feeForm.discountReason.trim()) { toast.add({ color: 'warning', title: 'Enter a discount reason' }); return }
  savingFee.value = true
  try { await $fetch(`/api/students/${studentId}/fee-assignments`, { method: 'POST', body: { feePlanId: feeForm.feePlanId, startDate: feeForm.startDate, discount: Math.round(feeForm.discount * 100), discountReason: feeForm.discountReason || undefined } }); toast.add({ color: 'success', title: 'Fee plan assigned' }); Object.assign(feeForm, { feePlanId: null, startDate: new Date().toISOString().slice(0, 10), discount: 0, discountReason: '' }) } catch (error: any) { toast.add({ color: 'error', title: 'Could not assign fee plan', description: error.data?.statusMessage || error.message }) } finally { savingFee.value = false }
}

async function savePortalAccess() {
  savingPortal.value = true
  try { await $fetch(`/api/students/${studentId}/portal-account`, { method: 'POST', body: portalForm }); portalForm.temporaryPassword = ''; toast.add({ color: 'success', title: 'Portal access saved' }) } catch (error: any) { toast.add({ color: 'error', title: 'Could not save portal access', description: error.data?.statusMessage || error.message }) } finally { savingPortal.value = false }
}

async function uploadAvatar(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
    toast.add({ color: 'warning', title: 'Choose an image up to 5 MB' })
    return
  }
  try {
    const formData = new FormData()
    formData.append('avatar', file)
    const result = await $fetch<{ path: string }>(`/api/students/${studentId}/avatar`, { method: 'POST', body: formData })
    if (student.value) student.value.avatar = result.path
    toast.add({ color: 'success', title: 'Profile photo updated' })
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not upload profile photo', description: error.data?.statusMessage || error.message })
  }
}

async function save() {
  saving.value = true
  try {
    await $fetch(`/api/students/${studentId}`, {
      method: 'PATCH',
      body: { ...form, email: form.email || null, phone: form.phone || null, dateOfBirth: form.dateOfBirth || null, gender: form.gender || null, address: form.address || null, city: form.city || null, stateProvince: form.stateProvince || null, country: form.country || null, countryCode: form.countryCode || null, postalCode: form.postalCode || null, emergencyContact: form.emergencyContact || null, emergencyPhone: form.emergencyPhone || null, medicalNotes: form.medicalNotes || null },
    })
    toast.add({ color: 'success', title: 'Student updated' })
    await router.push(`/students/${studentId}`)
  } catch (error: any) {
    toast.add({ color: 'error', title: 'Could not save changes', description: error.data?.statusMessage || error.message })
  } finally {
    saving.value = false
  }
}
</script>
