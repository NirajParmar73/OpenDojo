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
        <UFormField label="Address" class="md:col-span-2"><UInput v-model="form.address" /></UFormField>
        <UFormField label="Emergency contact"><UInput v-model="form.emergencyContact" /></UFormField>
        <UFormField label="Emergency phone"><UInput v-model="form.emergencyPhone" /></UFormField>
        <UFormField label="Medical notes" class="md:col-span-2"><UTextarea v-model="form.medicalNotes" :rows="3" /></UFormField>
        <div class="flex justify-end gap-3 pt-2 md:col-span-2"><UButton :to="`/students/${studentId}`" color="neutral" variant="ghost">Cancel</UButton><UButton type="submit" color="primary" :loading="saving">Save changes</UButton></div>
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const studentId = Number(route.params.id)
const saving = ref(false)
const form = reactive({ firstName: '', lastName: '', dojoId: null as number | null, status: 'active', email: '', phone: '', dateOfBirth: '', joinedAt: '', gender: undefined as string | undefined, address: '', emergencyContact: '', emergencyPhone: '', medicalNotes: '' })
const statusOptions = [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }, { label: 'Archived', value: 'archived' }]
const genderOptions = [{ label: 'Male', value: 'male' }, { label: 'Female', value: 'female' }, { label: 'Other', value: 'other' }]

const { data: student, pending, error } = await useFetch<any>(`/api/students/${studentId}`)
const { data: dojos } = await useFetch<any[]>('/api/dojos')
const dojoOptions = computed(() => (dojos.value || []).map(dojo => ({ label: dojo.name, value: dojo.id })))

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
    emergencyContact: student.value.emergencyContact || '',
    emergencyPhone: student.value.emergencyPhone || '',
    medicalNotes: student.value.medicalNotes || '',
  })
})

async function save() {
  saving.value = true
  try {
    await $fetch(`/api/students/${studentId}`, {
      method: 'PATCH',
      body: { ...form, email: form.email || null, phone: form.phone || null, dateOfBirth: form.dateOfBirth || null, gender: form.gender || null, address: form.address || null, emergencyContact: form.emergencyContact || null, emergencyPhone: form.emergencyPhone || null, medicalNotes: form.medicalNotes || null },
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
